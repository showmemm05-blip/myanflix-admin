"use client";

import { useCallback, useRef, useState } from "react";
import { uploadService } from "@/services/api/uploadService";

const CHUNK_UPLOAD_CONCURRENCY = 6;
const FILE_UPLOAD_CONCURRENCY = 4;

export type BundleAssetStatus = "pending" | "uploading" | "done" | "error";

export interface BundleAsset {
  relativePath: string;
  file: File;
  status: BundleAssetStatus;
  progress: number; // 0-100
  error?: string;
}

/**
 * Drives the externally-pre-transcoded upload flow: many independent files
 * (the original, the master playlist, every rendition's playlist + segments)
 * each uploaded through the same resumable chunked mechanism the classic
 * single-video upload uses — just tagged with a `relativePath` so the
 * backend knows where each one lands, instead of assuming there's only one
 * file. A separate hook from `upload-context.tsx` (not a modification of
 * it) since this flow's shape — many files, no transcode-status polling —
 * is genuinely different from the classic one-video-file pipeline.
 */
export function useExternalUpload() {
  const [assets, setAssets] = useState<BundleAsset[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const assetsRef = useRef<BundleAsset[]>(assets);
  assetsRef.current = assets;

  const setAssetList = useCallback((files: { relativePath: string; file: File }[]) => {
    setAssets(files.map((f) => ({ ...f, status: "pending" as const, progress: 0 })));
  }, []);

  const updateAsset = useCallback((relativePath: string, patch: Partial<BundleAsset>) => {
    setAssets((prev) => prev.map((a) => (a.relativePath === relativePath ? { ...a, ...patch } : a)));
  }, []);

  const uploadOne = useCallback(
    async (movieId: string, asset: BundleAsset, signal: AbortSignal) => {
      updateAsset(asset.relativePath, { status: "uploading", error: undefined });
      try {
        const { uploadId, chunkSize, totalChunks, uploadedChunks } = await uploadService.init(
          movieId,
          asset.file.name,
          asset.file.size,
          asset.relativePath,
        );

        const done = new Set(uploadedChunks);
        const remaining = Array.from({ length: totalChunks }, (_, i) => i).filter((n) => !done.has(n));
        let completed = done.size;
        if (completed > 0) {
          updateAsset(asset.relativePath, { progress: Math.round((completed / totalChunks) * 100) });
        }

        let nextIndex = 0;
        const worker = async () => {
          for (;;) {
            const idx = nextIndex++;
            if (idx >= remaining.length) return;
            const chunkNumber = remaining[idx];
            const start = chunkNumber * chunkSize;
            const chunk = asset.file.slice(start, start + chunkSize);
            await uploadService.uploadChunk(uploadId, chunkNumber, chunk, signal);
            completed++;
            updateAsset(asset.relativePath, { progress: Math.round((completed / totalChunks) * 100) });
          }
        };

        await Promise.all(Array.from({ length: Math.min(CHUNK_UPLOAD_CONCURRENCY, remaining.length) }, worker));
        await uploadService.complete(uploadId);
        updateAsset(asset.relativePath, { status: "done", progress: 100 });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        updateAsset(asset.relativePath, { status: "error", error: message });
        throw err;
      }
    },
    [updateAsset],
  );

  /** Uploads every asset not already `done` — safe to call again after a partial failure, resuming in place. */
  const uploadAll = useCallback(
    async (movieId: string) => {
      const controller = new AbortController();
      controllerRef.current = controller;
      const pending = assetsRef.current.filter((a) => a.status !== "done");

      let nextIndex = 0;
      let firstError: unknown = null;
      const worker = async () => {
        for (;;) {
          const idx = nextIndex++;
          if (idx >= pending.length) return;
          try {
            await uploadOne(movieId, pending[idx], controller.signal);
          } catch (err) {
            firstError ??= err;
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(FILE_UPLOAD_CONCURRENCY, pending.length) }, worker));
      if (firstError) throw firstError;
    },
    [uploadOne],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const overallProgress =
    assets.length === 0 ? 0 : Math.round(assets.reduce((sum, a) => sum + a.progress, 0) / assets.length);

  return {
    assets,
    setAssetList,
    uploadAll,
    cancel,
    overallProgress,
    isUploading: assets.some((a) => a.status === "uploading"),
    allDone: assets.length > 0 && assets.every((a) => a.status === "done"),
  };
}
