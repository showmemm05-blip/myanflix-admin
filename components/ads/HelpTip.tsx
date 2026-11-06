"use client";

import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";

interface HelpTipProps {
  /** What the help is about — the popover's heading ("Times played"). */
  title: string;
  /** The explanation: a sentence or two, or a short block. */
  children: ReactNode;
  /** The button's name for screen readers; defaults to "What does “{title}” mean?". */
  label?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * A small (?) next to a word that needs explaining (2026-11-04, the Ad
 * results cards and wherever else a label is not self-evident). It opens on
 * a tap or a click, never on hover — the owner reads these pages on a phone
 * too, where a hover tooltip never appears — and from the keyboard (Enter /
 * Space on the focused button; Escape or a tap outside closes it, and focus
 * goes back to the button). A real button with its own name, so a screen
 * reader says what it explains.
 */
export function HelpTip({ title, children, label, side = "bottom", align = "start", className }: HelpTipProps) {
  const { t } = useLanguage();
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={label ?? t.adsUi.shared.helpAbout(title)}
        className={cn(
          // 24 px: the smallest comfortable tap target, around a 16 px glyph.
          "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:text-foreground",
          className,
        )}
      >
        <CircleHelp className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-72 max-w-[calc(100vw-2rem)] gap-1.5 p-3">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
        </PopoverHeader>
        <PopoverDescription render={<div />} className="leading-relaxed">
          {children}
        </PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
