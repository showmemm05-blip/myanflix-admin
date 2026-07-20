"use client";

import { useRef } from "react";
import Image from "next/image";
import { CheckCircle2, FileText, UploadCloud, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface FileUploadFieldProps {
  label: string;
  hint?: string;
  accept: string;
  file: File | null;
  previewUrl?: string | null;
  progress?: number;
  variant?: "image" | "file";
  aspect?: "poster" | "wide";
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export function FileUploadField({
  label,
  hint,
  accept,
  file,
  previewUrl,
  progress,
  variant = "file",
  aspect = "wide",
  onChange,
  disabled = false,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploading = progress !== undefined && progress < 100;
  const isDone = progress !== undefined && progress >= 100;

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />

      {variant === "image" && previewUrl ? (
        <div
          className={cn(
            "group relative overflow-hidden rounded-lg border border-white/[0.08] bg-muted",
            aspect === "poster" ? "aspect-2/3 max-w-40" : "aspect-video w-full"
          )}
        >
          <Image src={previewUrl} alt={label} fill className="object-cover" sizes="320px" />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ) : file ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-secondary/40 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          </div>
          {isDone ? (
            <CheckCircle2 className="size-4 shrink-0 text-success" />
          ) : !disabled ? (
            <button type="button" onClick={() => onChange(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-secondary/20 px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-secondary/30 disabled:cursor-not-allowed disabled:opacity-50",
            aspect === "poster" ? "aspect-2/3 max-w-40" : "aspect-video w-full"
          )}
        >
          <UploadCloud className="size-5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Click to upload</span>
        </button>
      )}

      {isUploading && <Progress value={progress} className="h-1.5" />}
      {hint && !file && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
