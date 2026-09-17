"use client";

import { useCallback, useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  Unlink,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/lib/context/language-context";
import { uploadService } from "@/services/api/uploadService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * The extensions a chapter document may contain. This list is the schema:
 * anything not declared here is dropped when a document is parsed, on both
 * the editor and the reader side, which is what makes storing ProseMirror
 * JSON (rather than HTML) safe — no markup is ever persisted or replayed.
 *
 * Kept in a shared module-level const because the userwebsite reader builds
 * its renderer from the same list; the two must agree or a chapter would
 * render differently than it was written.
 */
export const CHAPTER_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    protocols: ["http", "https", "mailto"],
  }),
  Image.configure({ inline: false }),
];

function ToolbarButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(active && "bg-accent text-accent-foreground")}
      onClick={onClick}
    >
      <Icon className="size-4" />
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const { t } = useLanguage();

  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t.books.editor.linkPrompt, previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  }, [editor, t.books.editor.linkPrompt]);

  const insertImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        // Reuses the same image endpoint posters go through, so chapter
        // images live in MinIO alongside every other image rather than
        // being inlined as base64 into the document. "book" puts them in
        // images/book/ next to the covers — one folder for everything a
        // book owns.
        const { url } = await uploadService.uploadImage(file, "book");
        editor.chain().focus().setImage({ src: url }).run();
      } catch {
        toast.error(t.books.editor.saveFailedToast);
      }
    };
    input.click();
  }, [editor, t.books.editor.saveFailedToast]);

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-card/95 p-1.5 backdrop-blur">
      <ToolbarButton
        icon={Undo2}
        label={t.books.editor.undo}
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        icon={Redo2}
        label={t.books.editor.redo}
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        icon={Pilcrow}
        label={t.books.editor.paragraph}
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      />
      <ToolbarButton
        icon={Heading1}
        label={t.books.editor.heading1}
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        icon={Heading2}
        label={t.books.editor.heading2}
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        icon={Heading3}
        label={t.books.editor.heading3}
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        icon={Bold}
        label={t.books.editor.bold}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={Italic}
        label={t.books.editor.italic}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={Strikethrough}
        label={t.books.editor.strike}
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        icon={List}
        label={t.books.editor.bulletList}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrdered}
        label={t.books.editor.orderedList}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={Quote}
        label={t.books.editor.blockquote}
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        icon={Code}
        label={t.books.editor.codeBlock}
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolbarButton
        icon={Minus}
        label={t.books.editor.horizontalRule}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        icon={LinkIcon}
        label={t.books.editor.link}
        active={editor.isActive("link")}
        onClick={setLink}
      />
      <ToolbarButton
        icon={Unlink}
        label={t.books.editor.unlink}
        disabled={!editor.isActive("link")}
        onClick={() => editor.chain().focus().unsetLink().run()}
      />
      <ToolbarButton
        icon={ImagePlus}
        label={t.books.editor.image}
        onClick={insertImage}
      />
    </div>
  );
}

interface RichTextEditorProps {
  /** The chapter's ProseMirror document. Only read on mount and when the id changes. */
  content: Record<string, unknown> | null;
  onChange: (doc: Record<string, unknown>) => void;
  /** Changing this remounts the document — pass the chapter id. */
  documentKey: string;
  editable?: boolean;
}

export function RichTextEditor({
  content,
  onChange,
  documentKey,
  editable = true,
}: RichTextEditorProps) {
  const editor = useEditor(
    {
      extensions: CHAPTER_EXTENSIONS,
      content: content ?? undefined,
      editable,
      // Next renders this on the client only (the whole admin is "use
      // client"), but TipTap still warns unless this is explicit.
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            "prose-chapter min-h-[24rem] px-6 py-5 focus:outline-none",
        },
      },
      onUpdate: ({ editor: instance }) => {
        onChange(instance.getJSON() as Record<string, unknown>);
      },
    },
    // Rebuild for a different chapter rather than trying to swap content in
    // place, which would keep the previous chapter's undo history.
    [documentKey],
  );

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
