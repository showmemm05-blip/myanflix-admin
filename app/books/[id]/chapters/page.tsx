"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  FolderPlus,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import {
  BOOK_STATUS_TONE,
  getBookStatusLabel,
} from "@/components/books/columns";
import { EditionTabs } from "@/components/books/EditionTabs";
import { RichTextEditor } from "@/components/books/RichTextEditor";
import { ChapterPreview } from "@/components/books/ChapterPreview";
import { EditBookDialog } from "@/components/books/EditBookDialog";
import { SectionsPanel } from "@/components/books/SectionsPanel";
import { FileUploadField } from "@/components/movies/FileUploadField";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { languageLabel } from "@/lib/constants/book-options";
import { bookService } from "@/services/api/bookService";
import { uploadService } from "@/services/api/uploadService";
import { uploadBookPdf } from "@/lib/upload/upload-book-pdf";
import { ApiError } from "@/services/api/apiClient";
import type { TranslationShape } from "@/lib/i18n/translations";
import type {
  BookChapterSummary,
  BookEdition,
  BookPage,
  BookPart,
  BookProcessingStatus,
  BookSection,
  BookStatus,
  ChapterStatus,
} from "@/types/book";
import { toast } from "sonner";

/** The Select value that stands for "no part" — a chapter's partId is null then. */
const NO_PART = "__none__";

/** How long after the last keystroke a chapter saves itself. */
const AUTOSAVE_DELAY_MS = 2000;

/** Matches the movies upload flow's cadence — see upload-context.tsx. */
const POLL_INTERVAL_MS = 2500;

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

const CHAPTER_STATUS_TONE: Record<ChapterStatus, StatusTone> = {
  DRAFT: "neutral",
  UPLOADING: "info",
  PROCESSING: "info",
  READY: "success",
  FAILED: "danger",
};

/**
 * A chapter's own state, which is NOT its edition's: only DRAFT is shared
 * vocabulary with the book statuses, so the rest borrow the conversion
 * wording the upload panel already uses.
 */
function chapterStatusLabel(t: TranslationShape, status: ChapterStatus): string {
  const labels: Record<ChapterStatus, string> = {
    DRAFT: t.books.status.draft,
    UPLOADING: t.books.chapterUpload.uploading,
    PROCESSING: t.books.chapterUpload.converting,
    READY: t.books.chapterUpload.ready,
    FAILED: t.books.chapterUpload.failed,
  };
  return labels[status];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * The ONE workspace for both kinds of book.
 *
 * A chapter is the unit of content either way: a written chapter holds a
 * ProseMirror document, a PDF chapter holds its own uploaded file and the
 * pages converted from it — a serialised release. So the language tabs, the
 * chapter list, reordering, the cover image and publishing are shared, and
 * only the middle of the right-hand pane differs: the rich text editor for
 * one type, the conversion panel for the other.
 */
export default function BookChaptersPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const params = useParams<{ id: string }>();
  const bookId = params.id;

  const canEdit = can("BOOKS.EDIT");
  const canPublish = can("BOOKS.PUBLISH");

  const {
    data: book,
    error,
    refetch,
  } = useAsyncData(() => bookService.getBookById(bookId), [bookId]);

  /** Written books get the editor; PDF books get the per-chapter conversion panel. */
  const isPdfBook = book?.type === "PDF";

  // ---- The language being edited ----------------------------------------

  const [editionId, setEditionId] = useState<string | null>(null);
  const edition = book?.editions.find((e) => e.id === editionId) ?? null;

  /**
   * Resolve the working language from the book itself. This only runs when a
   * fetch resolves (`book` is a fresh object), so the selection EditionTabs
   * makes after adding or removing a language survives the refetch that
   * follows it — and a language that disappeared falls back to the first.
   */
  useEffect(() => {
    if (!book || book.editions.length === 0) return;
    setEditionId((current) =>
      current && book.editions.some((e) => e.id === current)
        ? current
        : book.editions[0].id,
    );
  }, [book]);

  // ---- The chapters of that language ------------------------------------

  /**
   * Bumped when the SERVER has reordered the list behind our back — moving
   * a chapter into a part, reordering or deleting parts all renumber the
   * edition's reading order — so the list is re-read rather than guessed.
   */
  const [chaptersVersion, setChaptersVersion] = useState(0);

  const {
    data: chapterList,
    isLoading: loadingChapters,
    error: chaptersError,
  } = useAsyncData(
    () =>
      editionId
        ? bookService.getChapters(bookId, editionId)
        : Promise.resolve<BookChapterSummary[]>([]),
    [bookId, editionId, chaptersVersion],
  );

  // Local overlay so reorders, adds and conversion progress show instantly
  // without a refetch round trip (the movies/series list pattern). It is
  // STAMPED with the language it belongs to: an autosave that lands after
  // the admin switched tabs must not paint one language's chapter list under
  // another.
  const [chapterOverride, setChapterOverride] = useState<{
    editionId: string;
    items: BookChapterSummary[];
  } | null>(null);
  // Memoised because a fresh `[]` every render would re-run the effect that
  // opens the first chapter on every commit.
  const chapters = useMemo(
    () =>
      chapterOverride && chapterOverride.editionId === editionId
        ? chapterOverride.items
        : (chapterList ?? []),
    [chapterOverride, chapterList, editionId],
  );

  /**
   * A mirror for the callbacks that must NOT be rebuilt when the list
   * changes — the conversion poller writes progress into the list on every
   * tick, and taking the list as a dependency would tear its interval down
   * and restart it each time, so it would never fire.
   */
  const chaptersRef = useRef(chapters);
  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  // ---- The parts of that language (optional grouping) --------------------

  const [partsVersion, setPartsVersion] = useState(0);
  const { data: partList } = useAsyncData(
    () =>
      editionId
        ? bookService.getParts(bookId, editionId)
        : Promise.resolve<BookPart[]>([]),
    [bookId, editionId, partsVersion],
  );
  // Overlaid and stamped exactly like the chapter list, for the same reason.
  const [partsOverride, setPartsOverride] = useState<{
    editionId: string;
    items: BookPart[];
  } | null>(null);
  const parts = useMemo(
    () =>
      partsOverride && partsOverride.editionId === editionId
        ? partsOverride.items
        : (partList ?? []),
    [partsOverride, partList, editionId],
  );

  /**
   * The list as it reads: unparted chapters first (under no heading), then
   * each part's chapters. A chapter whose part is unknown here — the part
   * list still loading, or a row added before it arrived — counts as
   * unparted, which is what the server does too. With no parts this is one
   * headless group holding every chapter, in the order they came.
   */
  const groups = useMemo(() => {
    const known = new Set(parts.map((p) => p.id));
    return [
      {
        part: null as BookPart | null,
        chapters: chapters.filter((c) => !c.partId || !known.has(c.partId)),
      },
      ...parts.map((part) => ({
        part: part as BookPart | null,
        chapters: chapters.filter((c) => c.partId === part.id),
      })),
    ];
  }, [chapters, parts]);

  /**
   * Each chapter's position in that reading order — what the server calls
   * its `number`. Used while an optimistic overlay is on screen, when the
   * rows' own numbers may be a step behind; otherwise the server's stands.
   */
  const positionNumbers = useMemo(() => {
    const numbers = new Map<string, string>();
    let position = 0;
    for (const group of groups) {
      for (const c of group.chapters) {
        position += 1;
        numbers.set(c.id, String(position));
      }
    }
    return numbers;
  }, [groups]);

  /**
   * Patch ONE chapter of ONE language in the overlay. Stamped like the
   * overlay itself: a write that lands after the admin switched tabs still
   * updates its own language (the render ignores it) and never clobbers the
   * language now on screen.
   */
  const patchChapter = useCallback(
    (
      targetEditionId: string,
      chapterId: string,
      patch: Partial<BookChapterSummary>,
    ) => {
      setChapterOverride((prev) => {
        if (prev && prev.editionId !== targetEditionId) return prev;
        const base = prev?.items ?? chaptersRef.current;
        return {
          editionId: targetEditionId,
          items: base.map((c) =>
            c.id === chapterId ? { ...c, ...patch } : c,
          ),
        };
      });
    },
    [],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  /**
   * The document the preview renders. Snapshotted from docRef when preview
   * is entered rather than read during render: the editor writes straight
   * into the ref (no re-render per keystroke, by design), and reading a ref
   * while rendering is exactly the pattern that silently shows stale text.
   */
  const [previewDoc, setPreviewDoc] = useState<Record<string, unknown> | null>(
    null,
  );
  const [editBookOpen, setEditBookOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  /**
   * What a publish just made this language, so the badge flips the instant
   * the PUT resolves instead of waiting for the refetch behind it. Stamped
   * with the edition, so it can never colour another language's badge, and
   * the book's own value takes over again as soon as it lands.
   */
  const [publishedStatus, setPublishedStatus] = useState<{
    editionId: string;
    status: BookStatus;
  } | null>(null);
  const status = edition
    ? publishedStatus?.editionId === edition.id
      ? publishedStatus.status
      : edition.status
    : null;

  // Select the first chapter once the list arrives, but never fight the
  // admin's own selection afterwards.
  useEffect(() => {
    if (!selectedId && chapters.length > 0) setSelectedId(chapters[0].id);
  }, [chapters, selectedId]);

  const [draftTitle, setDraftTitle] = useState("");
  /**
   * The live title, updated in the SAME tick as the input.
   *
   * The debounced save used to read `draftTitle` through a closure, and
   * `setDraftTitle` does not update the current render — so the timer
   * scheduled by a keystroke carried the value from BEFORE that keystroke.
   * Since every keystroke resets the timer, only the last one ever fired,
   * and it always saved one edit behind: typing "Chapter 1" stored
   * "Chapter". This is the same trick `docRef` already uses for the
   * document, which is why the body never had the bug.
   */
  const titleRef = useRef("");
  const applyTitle = useCallback((value: string) => {
    titleRef.current = value;
    setDraftTitle(value);
  }, []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const docRef = useRef<Record<string, unknown> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Switching language swaps the whole workspace. The open chapter, the
   * editor's text and the overlay all belong to the language being left —
   * carrying any of them across would show Burmese prose under the English
   * tab, and the next autosave would then write it there.
   *
   * docRef is deliberately NOT cleared here: the flush below still needs the
   * outgoing text, and it captures it by value before this render's effects.
   */
  const handleSelectEdition = (next: BookEdition) => {
    if (next.id === editionId) return;
    setEditionId(next.id);
    setChapterOverride(null);
    setPartsOverride(null);
    setSectionsOverride(null);
    setSelectedId(null);
    setPreviewing(false);
    setPreviewDoc(null);
    applyTitle("");
    setDirty(false);
  };

  // ---- The open chapter -------------------------------------------------

  const {
    data: chapter,
    isLoading: loadingChapter,
    error: chapterError,
  } = useAsyncData(
    () =>
      editionId && selectedId
        ? bookService.getChapter(bookId, editionId, selectedId)
        : Promise.resolve(null),
    [bookId, editionId, selectedId],
  );

  /** The open chapter as the LIST knows it — the copy the poller keeps fresh. */
  const openSummary = chapters.find((c) => c.id === selectedId) ?? null;

  /**
   * The open chapter's sections, as the panel last reported them. Stamped
   * with the chapter so a save landing after a switch never shows one
   * chapter's sections under another; the fetched chapter's own list is the
   * base, so a chapter that never had sections carries an empty one.
   */
  const [sectionsOverride, setSectionsOverride] = useState<{
    chapterId: string;
    items: BookSection[];
  } | null>(null);
  const sections = useMemo(
    () =>
      chapter && sectionsOverride && sectionsOverride.chapterId === chapter.id
        ? sectionsOverride.items
        : (chapter?.sections ?? []),
    [chapter, sectionsOverride],
  );

  const togglePreview = useCallback(() => {
    setPreviewing((wasPreviewing) => {
      if (!wasPreviewing) setPreviewDoc(docRef.current);
      return !wasPreviewing;
    });
  }, []);

  useEffect(() => {
    if (!chapter) return;
    applyTitle(chapter.title);
    docRef.current = chapter.content;
    setDirty(false);
  }, [chapter, applyTitle]);

  /**
   * The language, chapter id, title and body are passed in rather than closed
   * over, because the flush below has to save the chapter the author is
   * leaving — by the time that cleanup runs, `editionId` and `selectedId` are
   * already the new ones.
   *
   * `content` is nullable because a PDF chapter has none: its body is the
   * file it carries, so only its title is written here — and sending an
   * explicit null would fail the backend's @IsObject.
   */
  const persistChapter = useCallback(
    async (
      chapterEditionId: string,
      chapterId: string,
      title: string,
      content: Record<string, unknown> | null,
    ) => {
      const finalTitle = title.trim() || t.books.manage.newChapterTitle;
      setSaving(true);
      try {
        await bookService.updateChapter(bookId, chapterEditionId, chapterId, {
          title: finalTitle,
          ...(content ? { content } : {}),
        });
        setDirty(false);
        patchChapter(chapterEditionId, chapterId, { title: finalTitle });
      } catch (err) {
        toast.error(t.books.editor.saveFailedToast, {
          description:
            err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
        });
      } finally {
        setSaving(false);
      }
    },
    [bookId, patchChapter, t],
  );

  const saveChapter = useCallback(async () => {
    if (!editionId || !selectedId) return;
    // titleRef, not draftTitle: see its declaration. Reading state here is
    // what made the autosave persist one keystroke behind.
    await persistChapter(editionId, selectedId, titleRef.current, docRef.current);
  }, [persistChapter, editionId, selectedId]);

  /**
   * Debounced autosave. A book chapter is long-form writing — asking the
   * author to remember a Save button is how work gets lost — but every
   * keystroke firing a PUT would be worse, hence the delay.
   */
  const scheduleSave = useCallback(() => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveChapter(), AUTOSAVE_DELAY_MS);
  }, [saveChapter]);

  /**
   * Flush a pending autosave when the chapter OR the language changes, and
   * when the page unmounts, so switching either one mid-sentence never drops
   * the sentence.
   *
   * These mirrors are written in an effect, NOT in the render body: React
   * runs a commit's cleanups before its effects, so when the cleanup below
   * fires for a switch these still hold the OUTGOING language, chapter id
   * and title — which is exactly the chapter whose unsaved text is still in
   * docRef. Assigning them during render instead would hand the outgoing
   * text to the incoming chapter and overwrite it — across languages, that
   * would write Burmese into the English edition.
   */
  const outgoingEditionId = useRef(editionId);
  const outgoingId = useRef(selectedId);
  const outgoingTitle = useRef(draftTitle);
  const isDirty = useRef(dirty);
  const persistRef = useRef(persistChapter);
  useEffect(() => {
    outgoingEditionId.current = editionId;
    outgoingId.current = selectedId;
    outgoingTitle.current = draftTitle;
    isDirty.current = dirty;
    persistRef.current = persistChapter;
  });

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const leavingEditionId = outgoingEditionId.current;
      const id = outgoingId.current;
      // Null for a PDF chapter, whose title is the only thing to flush.
      const doc = docRef.current;
      if (isDirty.current && leavingEditionId && id) {
        void persistRef.current(
          leavingEditionId,
          id,
          outgoingTitle.current,
          doc,
        );
      }
    };
  }, [editionId, selectedId]);

  // ---- The open chapter's PDF (PDF books only) --------------------------

  /**
   * The picked-but-not-yet-uploaded file, and the bytes going up, both
   * belong to ONE chapter. Stamping them rather than resetting on every
   * switch means an upload started here keeps running (and keeps landing in
   * the right place) while the admin reads another chapter — its progress
   * bar simply isn't on screen.
   */
  const [pdfPick, setPdfPick] = useState<{
    chapterId: string;
    file: File;
  } | null>(null);
  const pdfFile = pdfPick?.chapterId === selectedId ? pdfPick.file : null;
  const [upload, setUpload] = useState<{
    editionId: string;
    chapterId: string;
    percent: number;
  } | null>(null);
  const uploadPercent =
    upload && upload.editionId === editionId && upload.chapterId === selectedId
      ? upload.percent
      : null;
  const [starting, setStarting] = useState(false);
  // A second click landing before the `starting` re-render disables the
  // button must not fire a second request — the ref flips synchronously.
  const startingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Polled status lives beside the fetched chapter rather than being fed
   * through refetch(): calling refetch on a timer flips isLoading and makes
   * the pane blink every 2.5 seconds.
   *
   * It carries the language AND the chapter it was read for, so switching
   * either drops it instead of showing one chapter's progress under
   * another's name.
   */
  const [polled, setPolled] = useState<{
    editionId: string;
    chapterId: string;
    value: BookProcessingStatus;
  } | null>(null);
  const live =
    polled && polled.editionId === editionId && polled.chapterId === selectedId
      ? polled.value
      : null;
  /**
   * The chapter whose pipeline we asked for and have not heard from yet.
   * POST .../chapters/:chapterId/process answers 202 immediately, while
   * BookProcessingService sets PROCESSING a moment later from its
   * fire-and-forget run — so a DRAFT/UPLOADING read in that window is stale,
   * and believing it would stop the poll before it ever started. Holding the
   * id rather than a bare flag keeps the wait tied to the chapter it was
   * started for: another chapter can never inherit it.
   */
  const awaitingPipeline = useRef<string | null>(null);

  const chapterStatus: ChapterStatus | null =
    live?.status ?? openSummary?.status ?? null;
  const processedPages = live?.processedPages ?? openSummary?.processedPages ?? 0;
  const pageCount = live?.pageCount ?? openSummary?.pageCount ?? 0;
  const percent =
    live?.percent ??
    (pageCount > 0 ? Math.round((processedPages / pageCount) * 100) : 0);
  const processingError =
    live?.processingError ?? openSummary?.processingError ?? null;
  const pdfFileSize = live?.pdfFileSize ?? openSummary?.pdfFileSize ?? null;

  const isConverting =
    chapterStatus === "UPLOADING" || chapterStatus === "PROCESSING";
  const isBusy = isConverting || uploadPercent !== null || starting;

  useEffect(() => {
    if (!editionId || !selectedId || !isConverting) return;
    let cancelled = false;
    const controller = new AbortController();

    const tick = async () => {
      try {
        const next = await bookService.getProcessingStatus(
          bookId,
          editionId,
          selectedId,
          controller.signal,
        );
        if (cancelled) return;
        if (awaitingPipeline.current === selectedId) {
          // The pipeline hasn't claimed the chapter yet — this is the row as
          // it was before the 202, not a run that stopped.
          if (next.status === "DRAFT" || next.status === "UPLOADING") return;
          awaitingPipeline.current = null;
        }
        setPolled({ editionId, chapterId: selectedId, value: next });
        // The sidebar reads its progress from the list, so the list learns
        // what the poll learned.
        patchChapter(editionId, selectedId, {
          status: next.status,
          pageCount: next.pageCount,
          processedPages: next.processedPages,
          processingError: next.processingError,
          pdfFileSize: next.pdfFileSize,
        });
        // The run finished — pull the full book so the language badges and
        // chapter counts catch up in one go.
        if (next.status === "READY" || next.status === "FAILED") refetch();
      } catch {
        // A failed poll is not worth surfacing; the next tick retries.
      }
    };

    const timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
    void tick();
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
    // selectedId and editionId are dependencies on purpose: switching either
    // must tear this interval down and start a fresh one against the chapter
    // now on screen.
  }, [isConverting, bookId, editionId, selectedId, patchChapter, refetch]);

  // The converted pages of the open chapter, loaded once there are any to
  // show. Tagged with the chapter they were fetched for so the previous
  // one's pages are never left on screen while the new ones are in flight —
  // useAsyncData keeps its last data until the next one resolves.
  const pagesKey = `${editionId}:${selectedId}`;
  const { data: fetchedPages } = useAsyncData<{
    key: string;
    pages: BookPage[];
  } | null>(async () => {
    if (!editionId || !selectedId || !isPdfBook || chapterStatus !== "READY")
      return null;
    return {
      key: pagesKey,
      pages: await bookService.getPages(bookId, editionId, selectedId),
    };
  }, [bookId, editionId, selectedId, isPdfBook, chapterStatus]);
  const pages =
    fetchedPages && fetchedPages.key === pagesKey ? fetchedPages.pages : null;

  /**
   * Starts — or restarts — ONE chapter's conversion. The ids are passed in
   * because this also runs at the end of an upload, by which time the admin
   * may already be looking at a different chapter.
   */
  const startConversion = useCallback(
    async (targetEditionId: string, chapterId: string) => {
      if (startingRef.current) return;
      startingRef.current = true;
      setStarting(true);
      // Optimistic PROCESSING so the poll starts on this render rather than
      // waiting for a row the pipeline has not written yet. The numbers
      // come from what we already know: a retry keeps the pages that
      // already converted, so zeroing them here would only flicker. Both
      // the pane (setPolled) and the sidebar (patchChapter) must flip —
      // a stale FAILED poll result for this chapter would otherwise keep
      // the pane on the failed view and never start the poll.
      const showConverting = () => {
        awaitingPipeline.current = chapterId;
        const known = chaptersRef.current.find((c) => c.id === chapterId);
        setPolled({
          editionId: targetEditionId,
          chapterId,
          value: {
            id: chapterId,
            title: known?.title ?? "",
            order: known?.order ?? 0,
            status: "PROCESSING",
            pageCount: known?.pageCount ?? 0,
            processedPages: known?.processedPages ?? 0,
            percent:
              known && known.pageCount > 0
                ? Math.round((known.processedPages / known.pageCount) * 100)
                : 0,
            processingError: null,
            pdfFileSize: known?.pdfFileSize ?? null,
            updatedAt: new Date().toISOString(),
          },
        });
        patchChapter(targetEditionId, chapterId, {
          status: "PROCESSING",
          processingError: null,
        });
      };
      try {
        await bookService.processChapter(bookId, targetEditionId, chapterId);
        showConverting();
        toast.success(t.books.chapterUpload.startedToast);
      } catch (err) {
        // Someone else (or a double press) already started this exact
        // conversion — that is progress to watch, not an error to report.
        if (err instanceof ApiError && err.status === 409) {
          showConverting();
          toast.info(t.books.chapterUpload.alreadyConvertingToast);
          return;
        }
        toast.error(t.books.chapterUpload.startFailedToast, {
          description:
            err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
        });
      } finally {
        startingRef.current = false;
        setStarting(false);
      }
    },
    [bookId, patchChapter, t],
  );

  /** The restart/retry button — same call either way, just a different story. */
  const handleRestartConversion = () => {
    if (!editionId || !selectedId) return;
    void startConversion(editionId, selectedId);
  };

  const handleUploadPdf = async () => {
    if (!editionId || !selectedId) return;
    if (!pdfFile) {
      toast.error(t.books.form.missingPdfToast);
      return;
    }
    const targetEditionId = editionId;
    const chapterId = selectedId;
    const controller = new AbortController();
    abortRef.current = controller;
    setUpload({ editionId: targetEditionId, chapterId, percent: 0 });
    try {
      await uploadBookPdf({
        bookId,
        editionId: targetEditionId,
        chapterId,
        file: pdfFile,
        signal: controller.signal,
        onProgress: (p) =>
          setUpload({ editionId: targetEditionId, chapterId, percent: p }),
      });
      setUpload(null);
      setPdfPick((pick) => (pick?.chapterId === chapterId ? null : pick));
      // Upload and conversion are one action from the admin's point of
      // view, so the bytes landing rolls straight into processing.
      await startConversion(targetEditionId, chapterId);
    } catch (err) {
      setUpload(null);
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(t.books.chapterUpload.uploadFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      abortRef.current = null;
    }
  };

  // ---- The open chapter's image (both types) ----------------------------

  /**
   * Which chapter's image the admin cleared from the picker. The backend has
   * no way to UNSET an image (imageUrl is validated as a URL, so "" is
   * refused) — clearing here only takes it off the picker so a replacement
   * can be chosen; the saved one stands until that replacement lands.
   */
  const [clearedImageId, setClearedImageId] = useState<string | null>(null);
  const [savingImage, setSavingImage] = useState(false);
  const imageUrl = openSummary?.imageUrl ?? null;
  const imagePreview = clearedImageId === selectedId ? null : imageUrl;

  const handleChapterImage = async (file: File | null) => {
    if (!editionId || !selectedId) return;
    if (!file) {
      setClearedImageId(selectedId);
      return;
    }
    const targetEditionId = editionId;
    const chapterId = selectedId;
    setSavingImage(true);
    try {
      const { url } = await uploadService.uploadImage(file, "book");
      const saved = await bookService.updateChapter(
        bookId,
        targetEditionId,
        chapterId,
        { imageUrl: url },
      );
      // Patch from the SAVE RESPONSE, never from `url`. POST /uploads/image
      // answers with minioService.publicUrl(), which bakes in
      // STREAM_PUBLIC_BASE_URL — a host that is right for storage but not
      // necessarily reachable from the browser (ours is a LAN IP while the
      // admin runs on localhost). Every read path re-hosts the stored value
      // against the CURRENT request, which is why the thumbnail used to be
      // broken until you navigated back and refetched it.
      patchChapter(targetEditionId, chapterId, { imageUrl: saved.imageUrl });
      setClearedImageId((id) => (id === chapterId ? null : id));
      toast.success(t.books.editor.savedToast);
    } catch (err) {
      toast.error(t.books.editor.saveFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setSavingImage(false);
    }
  };

  // ---- Chapter list actions --------------------------------------------

  const [adding, setAdding] = useState(false);
  const [deleteChapter, setDeleteChapter] = useState<BookChapterSummary | null>(
    null,
  );
  const [deletingChapter, setDeletingChapter] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  /** `partId` puts the new chapter straight into a part; omitted, it is unparted as before. */
  const handleAddChapter = async (partId?: string) => {
    if (!editionId) return;
    const target = editionId;
    setAdding(true);
    try {
      // A written chapter is born with an empty document and is READY at
      // once; a PDF chapter is born with nothing but a title and waits DRAFT
      // for its file.
      const created = await bookService.createChapter(bookId, target, {
        title: t.books.manage.newChapterTitle,
        ...(isPdfBook ? {} : { content: EMPTY_DOC }),
        ...(partId ? { partId } : {}),
      });
      setChapterOverride({
        editionId: target,
        items: [
          ...chapters,
          {
            id: created.id,
            title: created.title,
            order: created.order,
            imageUrl: created.imageUrl,
            status: created.status,
            pageCount: created.pageCount,
            processedPages: created.processedPages,
            processingError: created.processingError,
            pdfFileSize: created.pdfFileSize,
            partId: created.partId,
            number: created.number,
            sections: created.sections,
          },
        ],
      });
      setSelectedId(created.id);
      setPreviewing(false);
      toast.success(t.books.manage.chapterCreatedToast);
    } catch (err) {
      toast.error(t.books.editor.saveFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteChapter = async () => {
    if (!deleteChapter || !editionId) return;
    const target = editionId;
    setDeletingChapter(true);
    try {
      await bookService.deleteChapter(bookId, target, deleteChapter.id);
      const remaining = chapters.filter((c) => c.id !== deleteChapter.id);
      setChapterOverride({ editionId: target, items: remaining });
      if (selectedId === deleteChapter.id) {
        setSelectedId(remaining[0]?.id ?? null);
      }
      toast.success(t.books.manage.chapterDeletedToast);
      setDeleteChapter(null);
    } catch (err) {
      toast.error(t.books.editor.saveFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setDeletingChapter(false);
    }
  };

  /**
   * A drag moves a chapter WITHIN its group — dropping it onto a chapter of
   * another part is ignored, because changing the part is the Select on the
   * row. The full id list still goes to the server in reading order
   * (unparted, then each part), which for a book without parts is exactly
   * the list as dragged.
   */
  const handleReorder = async (fromId: string, toIndex: number) => {
    if (!editionId) return;
    const target = editionId;
    const ids = chapters.map((c) => c.id);
    const fromIndex = ids.indexOf(fromId);
    if (fromIndex === -1 || fromIndex === toIndex) return;
    const from = chapters[fromIndex];
    const to = chapters[toIndex];
    if (!to || (from.partId ?? null) !== (to.partId ?? null)) return;

    const moved_ = [...chapters];
    const [moved] = moved_.splice(fromIndex, 1);
    moved_.splice(toIndex, 0, moved);
    const known = new Set(parts.map((p) => p.id));
    const reordered = [
      ...moved_.filter((c) => !c.partId || !known.has(c.partId)),
      ...parts.flatMap((p) => moved_.filter((c) => c.partId === p.id)),
    ];
    // Optimistic: the list jumps immediately, and only reverts if the PATCH
    // fails — a drag that visibly lags is a drag that gets repeated.
    setChapterOverride({
      editionId: target,
      items: reordered.map((c, i) => ({
        ...c,
        order: i + 1,
        number: String(i + 1),
      })),
    });

    setReordering(true);
    try {
      await bookService.reorderChapters(
        bookId,
        target,
        reordered.map((c) => c.id),
      );
    } catch (err) {
      setChapterOverride({ editionId: target, items: chapters });
      toast.error(t.books.manage.reorderFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setReordering(false);
    }
  };

  // ---- Part actions -----------------------------------------------------

  const [addingPart, setAddingPart] = useState(false);
  const [partBusy, setPartBusy] = useState(false);
  const [deletePart, setDeletePart] = useState<BookPart | null>(null);
  const [deletingPart, setDeletingPart] = useState(false);

  const partFailed = (err: unknown) => {
    toast.error(t.books.editor.saveFailedToast, {
      description:
        err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
    });
  };

  /**
   * The server owns the reading order: whenever a part changes shape it
   * regroups and renumbers the chapters, so the list is re-read rather than
   * reshuffled here (an optimistic guess would only be right by luck).
   */
  const rereadChapters = () => {
    setChapterOverride(null);
    setChaptersVersion((v) => v + 1);
  };

  const handleAddPart = async () => {
    if (!editionId) return;
    const target = editionId;
    setAddingPart(true);
    try {
      const created = await bookService.createPart(
        bookId,
        target,
        t.books.hierarchy.newPartTitle,
      );
      setPartsOverride({ editionId: target, items: [...parts, created] });
      toast.success(t.books.hierarchy.partCreatedToast);
    } catch (err) {
      partFailed(err);
    } finally {
      setAddingPart(false);
    }
  };

  const handleRenamePart = async (partId: string, title: string) => {
    if (!editionId) return;
    const target = editionId;
    const finalTitle = title.trim() || t.books.hierarchy.newPartTitle;
    try {
      const saved = await bookService.updatePart(bookId, target, partId, {
        title: finalTitle,
      });
      setPartsOverride({
        editionId: target,
        items: parts.map((p) =>
          p.id === partId ? { ...p, title: saved.title } : p,
        ),
      });
      toast.success(t.books.hierarchy.partSavedToast);
    } catch (err) {
      partFailed(err);
    }
  };

  const handleDeletePart = async () => {
    if (!deletePart || !editionId) return;
    const target = editionId;
    setDeletingPart(true);
    try {
      await bookService.deletePart(bookId, target, deletePart.id);
      setPartsOverride({
        editionId: target,
        items: parts.filter((p) => p.id !== deletePart.id),
      });
      // Its chapters survive, unparted and moved to the front.
      rereadChapters();
      toast.success(t.books.hierarchy.partDeletedToast);
      setDeletePart(null);
    } catch (err) {
      partFailed(err);
    } finally {
      setDeletingPart(false);
    }
  };

  const handleMovePart = async (partId: string, direction: -1 | 1) => {
    if (!editionId) return;
    const target = editionId;
    const from = parts.findIndex((p) => p.id === partId);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= parts.length) return;
    const reordered = [...parts];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setPartsOverride({
      editionId: target,
      items: reordered.map((p, i) => ({ ...p, order: i + 1, number: i + 1 })),
    });
    setPartBusy(true);
    try {
      await bookService.reorderParts(
        bookId,
        target,
        reordered.map((p) => p.id),
      );
      // Chapter numbers follow their parts.
      rereadChapters();
    } catch (err) {
      setPartsOverride({ editionId: target, items: parts });
      toast.error(t.books.manage.reorderFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setPartBusy(false);
    }
  };

  const handleAssignPart = async (chapterId: string, partId: string | null) => {
    if (!editionId) return;
    const target = editionId;
    try {
      await bookService.updateChapter(bookId, target, chapterId, { partId });
      rereadChapters();
      setPartsVersion((v) => v + 1);
    } catch (err) {
      partFailed(err);
    }
  };

  // ---- Publish ----------------------------------------------------------

  /**
   * Publishing is per language, and the backend asks for at least ONE READY
   * chapter — deliberately not all of them, so a serialised title goes live
   * while its later chapters are still converting. Written chapters are
   * READY the moment they exist; PDF ones only once they have converted.
   *
   * While the list is still loading, the edition's own count is the best
   * guess available; the backend enforces the real rule either way.
   */
  const readyChapterCount = chapterList
    ? chapters.filter((c) => c.status === "READY").length
    : (edition?.chapterCount ?? 0);

  const handleTogglePublish = async () => {
    if (!book || !edition) return;
    if (dirty) await saveChapter();

    const next = status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    if (next === "PUBLISHED" && readyChapterCount === 0) {
      toast.error(t.books.manage.publishNeedsChapter);
      return;
    }

    setPublishing(true);
    try {
      const updated = await bookService.updateEdition(bookId, edition.id, {
        status: next,
      });
      setPublishedStatus({ editionId: edition.id, status: updated.status });
      // The language tabs read their badges from the book, so pull it again.
      refetch();
      toast.success(
        next === "PUBLISHED"
          ? t.books.publishedToast
          : t.books.unpublishedToast,
        {
          description:
            next === "PUBLISHED"
              ? t.books.publishedDescription(
                  `${book.title} (${languageLabel(edition.language)})`,
                )
              : undefined,
        },
      );
    } catch (err) {
      toast.error(t.books.publishFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setPublishing(false);
    }
  };

  // ---- Render -----------------------------------------------------------

  if (error) {
    return (
      <RequirePermission
        permission="BOOKS.VIEW"
        title={t.books.manage.chaptersTitle}
        description={t.books.manage.chaptersDescription}
      >
        <div>
          <PageHeader title={t.books.manage.chaptersTitle} />
          <ErrorState description={t.books.page.loadError} onRetry={refetch} />
        </div>
      </RequirePermission>
    );
  }

  /** The picker is out of the way while the pipeline owns the chapter. */
  const showPicker = canEdit && chapterStatus !== "PROCESSING";

  /** The open chapter's thumbnail — the same control for both book types. */
  const chapterImageCard = canEdit ? (
    <Card className="gap-2 p-6">
      <FileUploadField
        label={t.books.chapterUpload.coverLabel}
        hint={t.books.chapterUpload.coverHint}
        accept="image/*"
        variant="image"
        aspect="poster"
        file={null}
        previewUrl={imagePreview}
        disabled={savingImage}
        onChange={(file) => void handleChapterImage(file)}
      />
      {savingImage && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {t.common.saving}
        </p>
      )}
    </Card>
  ) : null;

  return (
    <RequirePermission
      permission="BOOKS.VIEW"
      title={t.books.manage.chaptersTitle}
      description={t.books.manage.chaptersDescription}
    >
      <div>
        <PageHeader
          title={book?.title ?? t.books.manage.chaptersTitle}
          description={book?.author}
          actions={
            <div className="flex items-center gap-2">
              {status && (
                <StatusBadge
                  label={getBookStatusLabel(t, status)}
                  tone={BOOK_STATUS_TONE[status]}
                />
              )}
              <Button
                variant="ghost"
                render={<Link href="/books" />}
                nativeButton={false}
              >
                <ArrowLeft className="size-4" />
                {t.books.manage.backToBooks}
              </Button>
              {canEdit && book && (
                <Button variant="outline" onClick={() => setEditBookOpen(true)}>
                  <Pencil className="size-4" />
                  {t.books.actions.edit}
                </Button>
              )}
              {canPublish && status && (
                <Button disabled={publishing} onClick={handleTogglePublish}>
                  {publishing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Rocket className="size-4" />
                  )}
                  {status === "PUBLISHED"
                    ? t.books.editions.unpublishThis
                    : t.books.editions.publishThis}
                </Button>
              )}
            </div>
          }
        />

        {book && (
          <EditionTabs
            bookId={bookId}
            editions={book.editions}
            selectedId={editionId}
            onSelect={handleSelectEdition}
            onChanged={refetch}
          />
        )}

        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          {/* Chapter list */}
          <Card className="h-fit gap-3 p-4 lg:sticky lg:top-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">
                {t.books.manage.chaptersTitle}
              </h2>
              {canEdit && (
                <div className="flex items-center">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={addingPart || !editionId}
                    title={t.books.hierarchy.addPart}
                    onClick={() => void handleAddPart()}
                  >
                    {addingPart ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FolderPlus className="size-4" />
                    )}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={adding || !editionId}
                    title={t.books.manage.addChapter}
                    onClick={() => void handleAddChapter()}
                  >
                    {adding ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Keyed on the language's own load, not the book's: publishing
                refetches the book and must not flash the list away. */}
            {!edition || loadingChapters ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : chaptersError ? (
              <p className="py-6 text-center text-sm text-danger">
                {t.books.editor.loadError}
              </p>
            ) : chapters.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t.books.editions.emptyChapters}
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {t.books.manage.chaptersDescription}
                </p>
                <div className="space-y-1">
                  {groups.map((group) => {
                    const rows = group.chapters.map((c) => {
                      const index = chapters.findIndex((x) => x.id === c.id);
                      return (
                        <ChapterListRow
                          key={c.id}
                          chapter={c}
                          number={
                            // While an optimistic overlay is showing, the
                            // rows' own numbers may be a step behind the
                            // list's shape; the position is the truth then.
                            chapterOverride?.editionId === editionId
                              ? (positionNumbers.get(c.id) ?? c.number)
                              : c.number
                          }
                          selected={selectedId === c.id}
                          canEdit={canEdit}
                          isPdfBook={isPdfBook}
                          draggable={canEdit && !reordering}
                          dragging={draggingId === c.id}
                          parts={parts}
                          onDragStart={() => setDraggingId(c.id)}
                          onDrop={() => {
                            if (draggingId && draggingId !== c.id) {
                              void handleReorder(draggingId, index);
                            }
                            setDraggingId(null);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          onSelect={() => {
                            setSelectedId(c.id);
                            setPreviewing(false);
                          }}
                          onDelete={() => setDeleteChapter(c)}
                          onAssignPart={(partId) =>
                            void handleAssignPart(c.id, partId)
                          }
                        />
                      );
                    });
                    // The unparted group has no heading — with no parts at
                    // all it IS the list, exactly as before. Once parts
                    // exist it only shows (with its nudge) while non-empty.
                    if (!group.part) {
                      if (parts.length === 0) return rows;
                      if (rows.length === 0) return null;
                      return (
                        <div key="unparted" className="space-y-1">
                          <p className="px-2 pb-1 text-xs text-muted-foreground">
                            {t.books.hierarchy.unpartedHint}
                          </p>
                          {rows}
                        </div>
                      );
                    }
                    const part = group.part;
                    const partIndex = parts.findIndex((p) => p.id === part.id);
                    return (
                      <div key={part.id} className="space-y-1 pt-2">
                        <PartHeader
                          part={part}
                          canEdit={canEdit}
                          isFirst={partIndex === 0}
                          isLast={partIndex === parts.length - 1}
                          busy={partBusy}
                          adding={adding}
                          onRename={(title) =>
                            void handleRenamePart(part.id, title)
                          }
                          onMoveUp={() => void handleMovePart(part.id, -1)}
                          onMoveDown={() => void handleMovePart(part.id, 1)}
                          onDelete={() => setDeletePart(part)}
                          onAddChapter={() => void handleAddChapter(part.id)}
                        />
                        {rows}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          {/* The open chapter */}
          <div className="min-w-0 space-y-3">
            {!selectedId ? (
              <EmptyState
                icon={BookOpen}
                title={t.books.manage.noChaptersTitle}
                description={t.books.manage.noChaptersDescription}
                action={
                  canEdit && (
                    <Button
                      disabled={adding || !editionId}
                      onClick={() => void handleAddChapter()}
                    >
                      <Plus className="size-4" />
                      {t.books.manage.addChapter}
                    </Button>
                  )
                }
              />
            ) : chapterError ? (
              <ErrorState description={t.books.editor.loadError} />
            ) : loadingChapter || !chapter ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    value={draftTitle}
                    disabled={!canEdit}
                    placeholder={t.books.editor.chapterTitle}
                    className="h-10 text-base font-medium"
                    onChange={(e) => {
                      applyTitle(e.target.value);
                      scheduleSave();
                    }}
                  />
                  {/* There is nothing to preview in a PDF chapter — its
                      pages are shown below as they convert. */}
                  {!isPdfBook && (
                    <Button variant="outline" onClick={togglePreview}>
                      {previewing ? (
                        <Pencil className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                      {previewing
                        ? t.books.editor.edit
                        : t.books.editor.preview}
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      disabled={saving || !dirty}
                      onClick={() => void saveChapter()}
                    >
                      {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      {t.books.editor.save}
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {saving
                    ? t.common.saving
                    : dirty
                      ? t.books.editor.unsaved
                      : t.books.editor.saved}
                </p>

                {!isPdfBook ? (
                  previewing ? (
                    /* A written chapter always has a document; the
                       fallback is only for the type, which now allows the
                       null a PDF chapter carries. */
                    <ChapterPreview
                      title={draftTitle}
                      content={previewDoc ?? chapter.content ?? EMPTY_DOC}
                      sections={sections}
                    />
                  ) : (
                    <RichTextEditor
                      documentKey={chapter.id}
                      content={chapter.content}
                      editable={canEdit}
                      onChange={(doc) => {
                        docRef.current = doc;
                        scheduleSave();
                      }}
                    />
                  )
                ) : (
                  <>
                    {/* This chapter's own PDF: one file, one conversion, one
                        release — the whole reason a PDF book has chapters. */}
                    <Card className="gap-4 p-6">
                      <div className="space-y-1">
                        <h2 className="font-medium">
                          {t.books.chapterUpload.title}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {t.books.chapterUpload.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {chapterStatus && (
                          <StatusBadge
                            label={chapterStatusLabel(t, chapterStatus)}
                            tone={CHAPTER_STATUS_TONE[chapterStatus]}
                          />
                        )}
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FileText className="size-3.5" />
                          {pdfFileSize !== null ? (
                            <span className="tabular-nums">
                              {formatBytes(pdfFileSize)}
                            </span>
                          ) : (
                            t.books.chapterUpload.noFile
                          )}
                        </span>
                      </div>

                      {isConverting && (
                        <div className="space-y-2">
                          <Progress value={percent} />
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span className="tabular-nums">
                              {t.books.chapterUpload.pagesConverted(
                                processedPages,
                                pageCount,
                              )}
                            </span>
                            <span className="tabular-nums">{percent}%</span>
                          </div>
                        </div>
                      )}

                      {/* Said out loud rather than left to the button: a
                          run orphaned by a server restart is indistinguishable
                          from a slow one, and restarting keeps the pages that
                          already converted. */}
                      {canEdit && chapterStatus === "PROCESSING" && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">
                            {t.books.conversion.stalled}
                          </span>{" "}
                          {t.books.conversion.stalledDescription}
                        </p>
                      )}

                      {chapterStatus === "FAILED" && (
                        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
                          <p className="text-sm text-muted-foreground">
                            {processingError ??
                              t.books.conversion.failedUnknown}
                          </p>
                        </div>
                      )}

                      {showPicker && (
                        <FileUploadField
                          label={t.books.chapterUpload.pickFile}
                          hint={t.books.form.pdfHint}
                          accept="application/pdf,.pdf"
                          file={pdfFile}
                          progress={uploadPercent ?? undefined}
                          disabled={isBusy}
                          onChange={(file) =>
                            setPdfPick(
                              file ? { chapterId: selectedId, file } : null,
                            )
                          }
                        />
                      )}

                      <div className="flex flex-wrap justify-end gap-2">
                        {uploadPercent !== null && (
                          <Button
                            variant="ghost"
                            onClick={() => abortRef.current?.abort()}
                          >
                            {t.books.conversion.cancel}
                          </Button>
                        )}
                        {/* A conversion that a server restart orphaned looks
                            exactly like one still running, and the backend
                            accepts the restart — so the escape hatch is here
                            rather than only after a failure. */}
                        {canEdit && chapterStatus === "PROCESSING" && (
                          <Button
                            variant="ghost"
                            disabled={starting}
                            title={t.books.conversion.stalledDescription}
                            onClick={handleRestartConversion}
                          >
                            {starting ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <RefreshCw className="size-4" />
                            )}
                            {t.books.conversion.restart}
                          </Button>
                        )}
                        {canEdit && chapterStatus === "FAILED" && (
                          <Button
                            variant="outline"
                            disabled={starting || uploadPercent !== null}
                            onClick={handleRestartConversion}
                          >
                            {starting ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <RefreshCw className="size-4" />
                            )}
                            {t.books.chapterUpload.retry}
                          </Button>
                        )}
                        {showPicker && (
                          <Button
                            disabled={!pdfFile || isBusy}
                            onClick={handleUploadPdf}
                          >
                            {uploadPercent !== null || starting ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <UploadCloud className="size-4" />
                            )}
                            {t.books.chapterUpload.upload}
                          </Button>
                        )}
                      </div>
                    </Card>

                    {chapterImageCard}

                    {/* What the reader will actually turn through. */}
                    {chapterStatus === "READY" && (
                      <Card className="gap-4 p-6">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-success" />
                          <h2 className="font-medium">
                            {t.books.conversion.previewPages}
                          </h2>
                        </div>
                        {!pages || pages.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {t.books.conversion.previewEmpty}
                          </p>
                        ) : (
                          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                            {pages.map((page) => (
                              <figure
                                key={page.pageNumber}
                                className="space-y-1"
                              >
                                <div className="relative aspect-[3/4] overflow-hidden rounded border bg-muted">
                                  <Image
                                    src={page.url}
                                    alt={t.books.conversion.pageAlt(
                                      page.pageNumber,
                                    )}
                                    fill
                                    className="object-contain"
                                    sizes="160px"
                                    unoptimized
                                  />
                                </div>
                                <figcaption className="text-center text-xs tabular-nums text-muted-foreground">
                                  {page.pageNumber}
                                </figcaption>
                              </figure>
                            ))}
                          </div>
                        )}
                      </Card>
                    )}
                  </>
                )}

                {/* The chapter's optional sections — written ones append
                    their own text after the chapter's, PDF ones anchor a
                    page range. Remounted per chapter so a pending section
                    save flushes on the way out, like the chapter's own. */}
                <SectionsPanel
                  key={chapter.id}
                  bookId={bookId}
                  editionId={chapter.editionId}
                  chapterId={chapter.id}
                  chapterNumber={openSummary?.number ?? chapter.number}
                  isPdf={isPdfBook}
                  pageCount={pageCount}
                  sections={sections}
                  canEdit={canEdit}
                  onChange={(next) =>
                    setSectionsOverride({ chapterId: chapter.id, items: next })
                  }
                />

                {/* A written chapter's thumbnail belongs after the prose
                    it illustrates; a PDF chapter's is part of the release
                    being assembled, so it sits with the file above. */}
                {!isPdfBook && chapterImageCard}
              </>
            )}
          </div>
        </div>

        <EditBookDialog
          book={book ?? null}
          open={editBookOpen}
          onOpenChange={setEditBookOpen}
          onSaved={() => void refetch()}
        />

        <ConfirmDialog
          open={!!deleteChapter}
          onOpenChange={(o) => !o && setDeleteChapter(null)}
          title={t.books.manage.deleteChapterTitle}
          description={
            deleteChapter
              ? t.books.manage.deleteChapterDescription(deleteChapter.title)
              : ""
          }
          confirmLabel={t.common.delete}
          variant="destructive"
          loading={deletingChapter}
          onConfirm={handleDeleteChapter}
        />

        <ConfirmDialog
          open={!!deletePart}
          onOpenChange={(o) => !o && setDeletePart(null)}
          title={t.books.hierarchy.deletePartTitle}
          description={
            deletePart
              ? t.books.hierarchy.deletePartDescription(deletePart.title)
              : ""
          }
          confirmLabel={t.common.delete}
          variant="destructive"
          loading={deletingPart}
          onConfirm={() => void handleDeletePart()}
        />
      </div>
    </RequirePermission>
  );
}

// ---- Chapter list pieces --------------------------------------------------

interface ChapterListRowProps {
  chapter: BookChapterSummary;
  /** The reading-order number shown before the title ("3"). */
  number: string;
  selected: boolean;
  canEdit: boolean;
  isPdfBook: boolean;
  draggable: boolean;
  dragging: boolean;
  /** The edition's parts — the move-to-part control only appears once there are any. */
  parts: BookPart[];
  onDragStart: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onSelect: () => void;
  onDelete: () => void;
  onAssignPart: (partId: string | null) => void;
}

/**
 * One row of the chapter list — the markup the list always had, lifted out
 * so the grouped list can reuse it under each part heading. The only
 * addition is the move-to-part Select, and it renders only once the
 * edition has parts.
 */
function ChapterListRow({
  chapter: c,
  number,
  selected,
  canEdit,
  isPdfBook,
  draggable,
  dragging,
  parts,
  onDragStart,
  onDrop,
  onDragEnd,
  onSelect,
  onDelete,
  onAssignPart,
}: ChapterListRowProps) {
  const { t } = useLanguage();
  const currentPart = c.partId ?? NO_PART;
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors ${
        selected
          ? "border-primary/40 bg-primary/10"
          : "border-transparent hover:bg-secondary/40"
      } ${dragging ? "opacity-50" : ""}`}
    >
      {canEdit && (
        <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
      )}
      {/* Every chapter can carry its own thumbnail now. */}
      {c.imageUrl && (
        <div className="relative h-9 w-7 shrink-0 overflow-hidden rounded bg-muted">
          <Image
            src={c.imageUrl}
            alt={c.title}
            fill
            className="object-cover"
            sizes="28px"
            unoptimized
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <button type="button" className="w-full text-left" onClick={onSelect}>
          <p className="truncate text-sm">
            <span className="tabular-nums text-muted-foreground">
              {number}.
            </span>{" "}
            {c.title}
          </p>
          {/* A PDF chapter is a release of its own, so the row
              says where its conversion has got to. A written
              chapter is READY the moment it exists — saying so
              on every row would be noise. */}
          {isPdfBook && (
            <p
              className={`truncate text-xs ${
                c.status === "FAILED" ? "text-danger" : "text-muted-foreground"
              }`}
            >
              {chapterStatusLabel(t, c.status)}
              {c.status === "PROCESSING" && c.pageCount > 0 && (
                <span className="tabular-nums">
                  {" · "}
                  {t.books.chapterUpload.pagesConverted(
                    c.processedPages,
                    c.pageCount,
                  )}
                </span>
              )}
            </p>
          )}
        </button>
        {/* Moving between parts is a choice, not a drag: the server
            regroups and renumbers, so the list is re-read after it. */}
        {canEdit && parts.length > 0 && (
          <Select
            value={currentPart}
            onValueChange={(v) => {
              if (v && v !== currentPart) onAssignPart(v === NO_PART ? null : v);
            }}
          >
            <SelectTrigger
              size="sm"
              className="mt-1 h-6 w-full max-w-full text-xs"
              title={t.books.hierarchy.moveToPart}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PART}>{t.books.hierarchy.noPart}</SelectItem>
              {parts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {t.books.hierarchy.partLabel(p.number)} · {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {canEdit && (
        <Button
          size="icon-sm"
          variant="ghost"
          className="opacity-0 transition-opacity group-hover:opacity-100"
          title={t.common.delete}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

interface PartHeaderProps {
  part: BookPart;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  /** A part reorder in flight — the arrows wait for it. */
  busy: boolean;
  /** A chapter being added anywhere — one at a time. */
  adding: boolean;
  onRename: (title: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onAddChapter: () => void;
}

/**
 * The heading above a part's chapters: its number (positional, from the
 * server), an inline title that saves on blur or Enter, and the part's own
 * controls. The label is plain text with no letter-spacing — the Burmese
 * form must never be tracked out.
 */
function PartHeader({
  part,
  canEdit,
  isFirst,
  isLast,
  busy,
  adding,
  onRename,
  onMoveUp,
  onMoveDown,
  onDelete,
  onAddChapter,
}: PartHeaderProps) {
  const { t } = useLanguage();
  const h = t.books.hierarchy;
  const [title, setTitle] = useState(part.title);
  const commit = () => {
    if (title.trim() !== part.title) onRename(title);
  };
  return (
    <div className="group/part flex items-center gap-1 px-1">
      <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
        {h.partLabel(part.number)}
      </span>
      {canEdit ? (
        <Input
          value={title}
          placeholder={h.partTitlePlaceholder}
          aria-label={h.renamePart}
          className="h-6 min-w-0 flex-1 border-transparent bg-transparent px-1 text-xs font-medium shadow-none"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {part.title}
        </span>
      )}
      {canEdit && (
        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/part:opacity-100 focus-within:opacity-100">
          <Button
            size="icon-xs"
            variant="ghost"
            title={h.moveUp}
            disabled={busy || isFirst}
            onClick={onMoveUp}
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            title={h.moveDown}
            disabled={busy || isLast}
            onClick={onMoveDown}
          >
            <ChevronDown className="size-3.5" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            title={h.addChapterToPart}
            disabled={adding}
            onClick={onAddChapter}
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            title={t.common.delete}
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
