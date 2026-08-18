import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-[var(--field)] shadow-[var(--shadow-field)] px-2.5 py-2 text-base transition-colors outline-none placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25 md:text-sm dark:disabled:bg-muted dark:aria-invalid:border-destructive/60 dark:aria-invalid:ring-destructive/25",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
