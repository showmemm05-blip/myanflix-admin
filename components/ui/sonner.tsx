"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckIcon, InfoIcon, TriangleAlertIcon, XIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      // Layout props (expand/gap/offset/visibleToasts) are deliberately left
      // at their defaults — sonner sizes and stacks toasts from its own
      // internal measurements, and overriding them was enough to collapse
      // the list to zero width. The restyle in globals.css is likewise
      // appearance-only, for the same reason.
      //
      // Solid glyphs rather than outlined circle/octagon badges: the colored
      // chip behind them already carries the shape, so a second ring inside
      // it just reads as noise at this size. See globals.css for the chip.
      icons={{
        success: <CheckIcon className="size-4" strokeWidth={2.75} />,
        info: <InfoIcon className="size-4" strokeWidth={2.25} />,
        warning: <TriangleAlertIcon className="size-4" strokeWidth={2.25} />,
        error: <XIcon className="size-4" strokeWidth={2.75} />,
        loading: <Loader2Icon className="size-4 animate-spin" strokeWidth={2.25} />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
