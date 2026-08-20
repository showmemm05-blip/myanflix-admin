"use client";

import { EyeOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLanguage } from "@/lib/context/language-context";

/**
 * Explains, once per screen, why phone numbers and IPs look redacted.
 *
 * The redaction itself is the SERVER's: without `TRACKING.PII_VIEW` the
 * values arrive already masked (`09*****369`, `203.0.113.***`), so there is
 * nothing here to hide or reveal and no reason to drop a column. This banner
 * only answers the question a masked value provokes — "is this broken, or am
 * I not allowed to see it?" — and it asks the permission rather than sniffing
 * the value for asterisks, because a mask is still just a string.
 *
 * Renders nothing for a caller who holds the permission: there is no
 * redaction to explain.
 */
export function MaskedPiiNotice({ canViewPii }: { canViewPii: boolean }) {
  const { t } = useLanguage();
  if (canViewPii) return null;

  return (
    <Alert>
      <EyeOff />
      <AlertTitle>{t.tracking.common.maskedNoticeTitle}</AlertTitle>
      <AlertDescription>{t.tracking.common.maskedNoticeDescription}</AlertDescription>
    </Alert>
  );
}
