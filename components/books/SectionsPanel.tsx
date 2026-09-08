"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RichTextEditor } from "@/components/books/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/context/language-context";
import { bookService } from "@/services/api/bookService";
import { ApiError } from "@/services/api/apiClient";
import type { BookSection } from "@/types/book";
import { toast } from "sonner";

/** Same cadence as the chapter's own autosave — see the chapters page. */
const AUTOSAVE_DELAY_MS = 2000;

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

interface SectionsPanelProps {
  bookId: string;
  editionId: string;
  chapterId: string;
  /** The chapter's own number ("3") — a section shows as "3.1", "3.2", ... */
  chapterNumber: string;
  /** PDF chapters carry page-anchor sections; written ones carry text. */
  isPdf: boolean;
  /** PDF chapters — pages the file reports; bounds a section's start page. */
  pageCount: number;
  sections: BookSection[];
  canEdit: boolean;
  /** The parent keeps the list (it feeds the preview), so every change reports up. */
  onChange: (next: BookSection[]) => void;
}

/** What a section still owes the server — coalesced per section, like the chapter's autosave. */
interface PendingSave {
  title?: string;
  content?: Record<string, unknown>;
}

/**
 * The optional subdivisions of ONE chapter.
 *
 * A written section is a heading plus its own document, appended after the
 * chapter's text when a reader opens it; a PDF section is a page anchor
 * that runs to the next one's start. Neither exists until an editor adds
 * one, so a chapter that never had sections is untouched by this panel.
 *
 * Numbering is positional and comes from the server with every response;
 * the badge shown here is `${chapterNumber}.${index + 1}`, which equals it
 * and stays right during an optimistic reorder.
 */
export function SectionsPanel({
  bookId,
  editionId,
  chapterId,
  chapterNumber,
  isPdf,
  pageCount,
  sections,
  canEdit,
  onChange,
}: SectionsPanelProps) {
  const { t } = useLanguage();
  const h = t.books.hierarchy;

  const [adding, setAdding] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BookSection | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // The list as the callbacks see it, without rebuilding them per render.
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  const failed = useCallback(
    (err: unknown) => {
      toast.error(t.books.editor.saveFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    },
    [t],
  );

  /** Numbers and (PDF) ranges shift with every structural change — re-read them. */
  const reload = useCallback(async () => {
    const next = await bookService.getSections(bookId, editionId, chapterId);
    onChange(next);
  }, [bookId, editionId, chapterId, onChange]);

  // ---- Debounced saves (written sections) ---------------------------------

  const pending = useRef(new Map<string, PendingSave>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const flushSection = useCallback(
    async (sectionId: string) => {
      const timer = timers.current.get(sectionId);
      if (timer) clearTimeout(timer);
      timers.current.delete(sectionId);
      const patch = pending.current.get(sectionId);
      pending.current.delete(sectionId);
      if (!patch) return;
      setSavingId(sectionId);
      try {
        const saved = await bookService.updateSection(
          bookId,
          editionId,
          chapterId,
          sectionId,
          {
            ...(patch.title !== undefined
              ? { title: patch.title.trim() || h.newSectionTitle }
              : {}),
            ...(patch.content ? { content: patch.content } : {}),
          },
        );
        onChange(
          sectionsRef.current.map((s) =>
            s.id === sectionId ? { ...s, title: saved.title } : s,
          ),
        );
      } catch (err) {
        failed(err);
      } finally {
        setSavingId((id) => (id === sectionId ? null : id));
      }
    },
    [bookId, editionId, chapterId, h.newSectionTitle, onChange, failed],
  );

  const scheduleSave = useCallback(
    (sectionId: string, patch: PendingSave) => {
      pending.current.set(sectionId, {
        ...pending.current.get(sectionId),
        ...patch,
      });
      const timer = timers.current.get(sectionId);
      if (timer) clearTimeout(timer);
      timers.current.set(
        sectionId,
        setTimeout(() => void flushSection(sectionId), AUTOSAVE_DELAY_MS),
      );
    },
    [flushSection],
  );

  // Flush whatever is still owed when the panel goes away — the parent
  // remounts it per chapter, so switching chapters lands here too.
  const flushRef = useRef(flushSection);
  useEffect(() => {
    flushRef.current = flushSection;
  });
  useEffect(() => {
    const owned = timers.current;
    const owed = pending.current;
    return () => {
      for (const timer of owned.values()) clearTimeout(timer);
      owned.clear();
      for (const id of Array.from(owed.keys())) void flushRef.current(id);
    };
  }, []);

  // ---- Title (both types) --------------------------------------------------

  const handleTitle = (section: BookSection, value: string) => {
    onChange(
      sectionsRef.current.map((s) =>
        s.id === section.id ? { ...s, title: value } : s,
      ),
    );
    scheduleSave(section.id, { title: value });
  };

  // ---- Add / delete --------------------------------------------------------

  const handleAdd = async () => {
    setAdding(true);
    try {
      const current = sectionsRef.current;
      if (isPdf) {
        const last = current[current.length - 1];
        const proposed = last?.endPage ? last.endPage + 1 : 1;
        const startPage = Math.min(Math.max(proposed, 1), Math.max(1, pageCount));
        await bookService.createSection(bookId, editionId, chapterId, {
          title: h.newSectionTitle,
          startPage,
        });
      } else {
        await bookService.createSection(bookId, editionId, chapterId, {
          title: h.newSectionTitle,
          content: EMPTY_DOC,
        });
      }
      await reload();
      toast.success(h.sectionCreatedToast);
    } catch (err) {
      failed(err);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      // Nothing owed for a row that is about to go.
      const timer = timers.current.get(deleting.id);
      if (timer) clearTimeout(timer);
      timers.current.delete(deleting.id);
      pending.current.delete(deleting.id);
      await bookService.deleteSection(bookId, editionId, chapterId, deleting.id);
      await reload();
      toast.success(h.sectionDeletedToast);
      setDeleting(null);
    } catch (err) {
      failed(err);
    } finally {
      setDeletingBusy(false);
    }
  };

  // ---- Reorder (written sections only) -------------------------------------

  const handleMove = async (sectionId: string, direction: -1 | 1) => {
    const current = sectionsRef.current;
    const from = current.findIndex((s) => s.id === sectionId);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= current.length) return;
    const reordered = [...current];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    // Optimistic, like the chapter list: the row jumps now and reverts only
    // if the PATCH fails.
    onChange(reordered.map((s, i) => ({ ...s, order: i + 1 })));
    setReordering(true);
    try {
      await bookService.reorderSections(
        bookId,
        editionId,
        chapterId,
        reordered.map((s) => s.id),
      );
      await reload();
    } catch (err) {
      onChange(current);
      toast.error(t.books.manage.reorderFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setReordering(false);
    }
  };

  // ---- Start page (PDF sections only) --------------------------------------

  /**
   * Typed values per section, committed on blur. The server re-sorts the
   * chapter's sections by start page and renumbers them, so the list is
   * re-read after each commit rather than sorted here.
   */
  const [pageDrafts, setPageDrafts] = useState<Record<string, string>>({});

  const commitStartPage = async (section: BookSection) => {
    const raw = pageDrafts[section.id];
    setPageDrafts((d) => {
      const next = { ...d };
      delete next[section.id];
      return next;
    });
    if (raw === undefined) return;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    const startPage = Math.min(Math.max(parsed, 1), Math.max(1, pageCount));
    if (startPage === section.startPage) return;
    setSavingId(section.id);
    try {
      await bookService.updateSection(
        bookId,
        editionId,
        chapterId,
        section.id,
        { startPage },
      );
      await reload();
    } catch (err) {
      failed(err);
    } finally {
      setSavingId((id) => (id === section.id ? null : id));
    }
  };

  // PDF: a new section starts on the page after the last one; once that
  // page is past the end there is nowhere to start it (the backend now
  // rejects a duplicate start page), so say so instead of trying.
  const lastSection = sections[sections.length - 1];
  const noFreePage = isPdf && pageCount > 0 && !!lastSection && (lastSection.endPage ?? 0) >= pageCount;
  const canAdd = canEdit && !adding && (!isPdf || pageCount > 0) && !noFreePage;

  return (
    <Card className="gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-medium">{h.sections}</h2>
          <p className="text-sm text-muted-foreground">{h.sectionsHint}</p>
        </div>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            disabled={!canAdd}
            title={
              isPdf && pageCount === 0 ? h.needsPagesFirst : noFreePage ? h.noPagesLeft : h.addSection
            }
            onClick={() => void handleAdd()}
          >
            {adding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {h.addSection}
          </Button>
        )}
      </div>

      {isPdf && pageCount === 0 && (
        <p className="text-xs text-muted-foreground">{h.needsPagesFirst}</p>
      )}

      {sections.length > 0 && (
        <div className="space-y-3">
          {sections.map((section, index) => {
            const number = `${chapterNumber}.${index + 1}`;
            const busy = savingId === section.id;
            return (
              <div
                key={section.id}
                className="space-y-3 rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="tabular-nums">
                    {number}
                  </Badge>
                  <Input
                    value={section.title}
                    disabled={!canEdit}
                    placeholder={h.sectionTitle}
                    aria-label={h.sectionLabel(number)}
                    className="h-8 flex-1"
                    onChange={(e) => handleTitle(section, e.target.value)}
                  />
                  {busy && (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                  )}
                  {canEdit && !isPdf && (
                    <>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        title={h.moveUp}
                        disabled={reordering || index === 0}
                        onClick={() => void handleMove(section.id, -1)}
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        title={h.moveDown}
                        disabled={reordering || index === sections.length - 1}
                        onClick={() => void handleMove(section.id, 1)}
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                    </>
                  )}
                  {canEdit && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      title={t.common.delete}
                      onClick={() => setDeleting(section)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                {isPdf ? (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      <span className="text-muted-foreground">{h.startPage}</span>
                      <Input
                        type="number"
                        min={1}
                        max={Math.max(1, pageCount)}
                        disabled={!canEdit || pageCount === 0}
                        className="h-8 w-24 tabular-nums"
                        value={pageDrafts[section.id] ?? section.startPage ?? ""}
                        onChange={(e) =>
                          setPageDrafts((d) => ({
                            ...d,
                            [section.id]: e.target.value,
                          }))
                        }
                        onBlur={() => void commitStartPage(section)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {h.startPageHint(Math.max(1, pageCount))}
                    </span>
                    {section.startPage !== null && section.endPage !== null && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {h.pageRange(section.startPage, section.endPage)}
                      </span>
                    )}
                  </div>
                ) : (
                  <RichTextEditor
                    documentKey={section.id}
                    content={section.content}
                    editable={canEdit}
                    onChange={(doc) => scheduleSave(section.id, { content: doc })}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{h.numberingAuto}</p>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={h.deleteSectionTitle}
        description={deleting ? h.deleteSectionDescription(deleting.title) : ""}
        confirmLabel={t.common.delete}
        variant="destructive"
        loading={deletingBusy}
        onConfirm={() => void handleDelete()}
      />
    </Card>
  );
}
