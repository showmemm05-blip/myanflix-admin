"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DreamPictureProps {
  src: string | null;
  /** Decorative in the table (the name sits beside it); the dialog passes the number. */
  alt?: string;
  className?: string;
  /** How the slot reads without a picture: a dash (the table) or an icon (the form). */
  placeholder?: "dash" | "icon";
}

/** A dream's picture in a square slot, or its placeholder. */
export function DreamPicture({ src, alt = "", className, placeholder = "dash" }: DreamPictureProps) {
  if (!src) {
    return placeholder === "dash" ? (
      <span className={cn("text-muted-foreground", className)}>—</span>
    ) : (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed border-input bg-secondary/20 text-muted-foreground",
          className,
        )}
      >
        <ImageIcon className="size-5" />
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-muted", className)}>
      <Image src={src} alt={alt} fill sizes="160px" className="object-cover" unoptimized draggable={false} />
    </div>
  );
}
