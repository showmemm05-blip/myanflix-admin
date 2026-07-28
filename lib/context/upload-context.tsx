"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { uploadService } from "@/services/api/uploadService";
import { movieService } from "@/services/api/movieService";
import { videoService } from "@/services/api/videoService";
import type { MovieUploadFormValues, UploadStage } from "@/types/movie";

const CHUNK_UPLOAD_CONCURRENCY = 6;
const PROCESSING_POLL_INTERVAL_MS = 2500;
/** How long a published task stays visible before it auto-dismisses. */
const PUBLISHED_DISMISS_DELAY_MS = 3000;

export interface PublishInput extends Omit<MovieUploadFormValues, "posterUrl" | "coverUrl"> {
  posterFile: File;
  coverFile: File | null;
  videoFile: File;
}

/** A task's stage while it's alive is never "idle" — that's only the form's own pre-publish state. */
export type TaskStage = Exclude<UploadStage, "idle">;

export interface UploadTask {
  id: string;
  title: string;
  stage: TaskStage;
  error?: string;
  /** Set once the movie record exists — lets a retry resume instead of recreating it. */
  movieId: string | null;
  // "uploading-video" substate
  videoProgress: number; // 0-100
  speedBps: number | null;
  etaSeconds: number | null;
  // "processing" substate
  processingElapsedSeconds: number;
  videoDurationSeconds: number | null;
  // Retained so a failed task can be retried from anywhere, not just the
  // page that started it — the File references stay valid as long as
  // something (this context, mounted at the root) still holds them, even
  // after the user has navigated to a completely different page.
  input: PublishInput;
}

interface UploadContextValue {
  tasks: UploadTask[];
  /**
   * Runs the full publish pipeline — image upload, movie creation, chunked
   * video upload, transcode polling, and finally marking the movie
   * published. Returns the new task's id immediately (so a caller can track
   * "its" task via `tasks`), plus a `done` promise resolving once the movie
   * is actually live.
   */
  startPublish: (input: PublishInput) => { id: string; done: Promise<{ movieId: string }> };
  retryUpload: (taskId: string) => void;
  dismissTask: (taskId: string) => void;
}

const UploadContext = createContext<UploadContextValue | undefined>(undefined);

function generateTaskId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // crypto.randomUUID() only exists in secure contexts (HTTPS, or
  // http://localhost) — over plain HTTP on a VPS it's undefined. This id is
  // just a client-side task-tracking key, never sent anywhere as a security
  // token, so a Math.random fallback is fine here.
  return `task_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const dismissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // One AbortController per in-flight task, threaded through every request
  // in the pipeline. Cancelling it — on failure or on manual dismiss — stops
  // whatever's still in flight (e.g. sibling chunk uploads, or the
  // processing poll loop) instead of leaving it running in the background.
  const controllers = useRef(new Map<string, AbortController>());
  // Always holds the latest tasks, so retryUpload can look one up by id
  // without needing `tasks` in its own dependency array.
  const tasksRef = useRef<UploadTask[]>(tasks);
  tasksRef.current = tasks;

  const updateTask = useCallback((id: string, patch: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const dismissTask = useCallback((id: string) => {
    const timer = dismissTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimers.current.delete(id);
    }
    const controller = controllers.current.get(id);
    if (controller) {
      controller.abort();
      controllers.current.delete(id);
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const uploadVideoChunks = useCallback(
    async (taskId: string, movieId: string, file: File, signal: AbortSignal) => {
      const { uploadId, chunkSize, totalChunks } = await uploadService.init(movieId, file.name, file.size);

      let nextChunk = 0;
      let completedChunks = 0;
      let uploadedBytes = 0;
      const startedAt = Date.now();

      const worker = async () => {
        for (;;) {
          const chunkNumber = nextChunk++;
          if (chunkNumber >= totalChunks) return;
          const start = chunkNumber * chunkSize;
          const chunk = file.slice(start, start + chunkSize);
          await uploadService.uploadChunk(uploadId, chunkNumber, chunk, signal);
          completedChunks++;
          uploadedBytes += chunk.size;

          const elapsedSeconds = (Date.now() - startedAt) / 1000;
          const speedBps = elapsedSeconds > 0.5 ? uploadedBytes / elapsedSeconds : null;
          updateTask(taskId, {
            videoProgress: Math.round((completedChunks / totalChunks) * 100),
            speedBps,
            etaSeconds: speedBps && speedBps > 0 ? (file.size - uploadedBytes) / speedBps : null,
          });
        }
      };

      await Promise.all(Array.from({ length: Math.min(CHUNK_UPLOAD_CONCURRENCY, totalChunks) }, worker));
      await uploadService.complete(uploadId);
    },
    [updateTask],
  );

  const pollProcessingStatus = useCallback(
    async (taskId: string, movieId: string, signal: AbortSignal) => {
      for (;;) {
        const status = await videoService.getProcessingStatus(movieId, signal);
        if (status.duration) updateTask(taskId, { videoDurationSeconds: status.duration });
        if (status.status === "READY" || status.status === "FAILED") return status.status;
        await sleep(PROCESSING_POLL_INTERVAL_MS, signal);
      }
    },
    [updateTask],
  );

  const runPublish = useCallback(
    async (taskId: string, input: PublishInput, resumeMovieId: string | null): Promise<{ movieId: string }> => {
      const controller = new AbortController();
      controllers.current.set(taskId, controller);
      const { signal } = controller;

      try {
        let movieId = resumeMovieId;

        if (!movieId) {
          updateTask(taskId, { stage: "uploading-images" });
          const posterUrl = (await uploadService.uploadImage(input.posterFile, signal)).url;
          const coverUrl = input.coverFile
            ? (await uploadService.uploadImage(input.coverFile, signal)).url
            : undefined;

          updateTask(taskId, { stage: "creating-movie" });
          const movie = await movieService.createMovie(
            {
              title: input.title,
              description: input.description,
              genre: input.genre,
              categoryIds: input.categoryIds,
              language: input.language,
              releaseYear: input.releaseYear,
              duration: input.duration,
              price: input.price,
              isPremium: input.isPremium,
              posterUrl,
              coverUrl,
            },
            signal,
          );
          movieId = movie.id;
          updateTask(taskId, { movieId });
        }

        updateTask(taskId, { stage: "uploading-video", videoProgress: 0, speedBps: null, etaSeconds: null });
        await uploadVideoChunks(taskId, movieId, input.videoFile, signal);

        updateTask(taskId, { stage: "processing", processingElapsedSeconds: 0 });
        const elapsedTimer = setInterval(() => {
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, processingElapsedSeconds: t.processingElapsedSeconds + 1 } : t)),
          );
        }, 1000);
        let result: Awaited<ReturnType<typeof pollProcessingStatus>>;
        try {
          result = await pollProcessingStatus(taskId, movieId, signal);
        } finally {
          clearInterval(elapsedTimer);
        }

        if (result === "FAILED") {
          throw new Error("Video processing failed — the upload succeeded but transcoding did not.");
        }

        await movieService.updateMovie(movieId, { status: "PUBLISHED" }, signal);
        controllers.current.delete(taskId);
        updateTask(taskId, { stage: "published" });
        const timer = setTimeout(() => dismissTask(taskId), PUBLISHED_DISMISS_DELAY_MS);
        dismissTimers.current.set(taskId, timer);
        return { movieId };
      } catch (err) {
        // Cancel any sibling requests still in flight (e.g. other chunk
        // workers) instead of leaving them running in the background.
        controller.abort();
        controllers.current.delete(taskId);
        const message = err instanceof Error ? err.message : "Publish failed";
        updateTask(taskId, { stage: "error", error: message });
        throw err;
      }
    },
    [updateTask, dismissTask, uploadVideoChunks, pollProcessingStatus],
  );

  const startPublish = useCallback(
    (input: PublishInput) => {
      const id = generateTaskId();
      setTasks((prev) => [
        ...prev,
        {
          id,
          title: input.title,
          stage: "uploading-images",
          movieId: null,
          videoProgress: 0,
          speedBps: null,
          etaSeconds: null,
          processingElapsedSeconds: 0,
          videoDurationSeconds: null,
          input,
        },
      ]);
      return { id, done: runPublish(id, input, null) };
    },
    [runPublish],
  );

  const retryUpload = useCallback(
    (taskId: string) => {
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task) return;
      updateTask(taskId, {
        stage: task.movieId ? "uploading-video" : "uploading-images",
        error: undefined,
      });
      runPublish(taskId, task.input, task.movieId).catch(() => {});
    },
    [runPublish, updateTask],
  );

  return (
    <UploadContext.Provider value={{ tasks, startPublish, retryUpload, dismissTask }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUploads(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUploads must be used within an UploadProvider");
  return ctx;
}
