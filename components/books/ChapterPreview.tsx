"use client";

import { useMemo } from "react";
import { generateHTML } from "@tiptap/html";
import { CHAPTER_EXTENSIONS } from "./RichTextEditor";
import type { BookSection } from "@/types/book";

/**
 * The document a reader sees: the chapter's own blocks, then each section
 * as a level-2 heading (`1.1 Title`) followed by its blocks.
 *
 * This is the same compose rule the website and mobile readers apply, so
 * the preview matches them. With no sections it returns `content` ITSELF —
 * the same object, not a copy — so a chapter that never used sections is
 * rendered from exactly the document it always was.
 */
export function composeChapterDoc(
  content: Record<string, unknown>,
  sections: BookSection[] | undefined,
): Record<string, unknown> {
  if (!sections || sections.length === 0) return content;
  const base = Array.isArray(content.content) ? content.content : [];
  const blocks: unknown[] = [...base];
  for (const section of sections) {
    blocks.push({
      type: "heading",
      attrs: { level: 2 },
      content: [
        { type: "text", text: `${section.number} ${section.title}`.trim() },
      ],
    });
    const own = section.content?.content;
    if (Array.isArray(own)) blocks.push(...own);
  }
  return { type: "doc", content: blocks };
}

/**
 * Renders a chapter document exactly as a reader will see it, in the same
 * reading measure the user site uses — the point of the preview is to catch
 * "this looks wrong at reading width", which a full-bleed admin column
 * would hide.
 *
 * `generateHTML` re-parses the document through CHAPTER_EXTENSIONS, so any
 * node the schema doesn't know is dropped rather than rendered. That, plus
 * the fact that the stored document is JSON and never HTML, is what makes
 * this safe to inject.
 */
export function ChapterPreview({
  title,
  content,
  sections,
}: {
  title: string;
  content: Record<string, unknown>;
  /** The chapter's sections, appended after its own text like a reader does. */
  sections?: BookSection[];
}) {
  const html = useMemo(() => {
    try {
      return generateHTML(
        composeChapterDoc(content, sections),
        CHAPTER_EXTENSIONS,
      );
    } catch {
      return "";
    }
  }, [content, sections]);

  return (
    <div className="rounded-lg border bg-card px-6 py-8">
      <div className="mx-auto max-w-[38rem]">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
        <div
          className="prose-chapter"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
