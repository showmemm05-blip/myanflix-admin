"use client";

import { useLanguage } from "@/lib/context/language-context";

/**
 * "Ad settings" inside a sentence ("You can change this in Ad settings."):
 * a link-styled button that leaves the wizard for the settings card when
 * the page offers that, else the plain words.
 */
export function SettingsLink({ onOpen }: { onOpen?: () => void }) {
  const { t } = useLanguage();
  const words = t.adsUi.shared.adSettings;
  if (!onOpen) return <b className="font-medium text-foreground">{words}</b>;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-sm font-medium text-info underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {words}
    </button>
  );
}
