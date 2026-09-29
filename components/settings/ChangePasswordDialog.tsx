"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";
import { useLanguage } from "@/lib/context/language-context";

/**
 * The navbar's change-password entry point — the one every staff role can
 * reach, since only SUPER_ADMIN holds SETTINGS.VIEW. The form is remounted on
 * each open so a typed secret never survives a close.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.settings.security.dialogTitle}</DialogTitle>
          <DialogDescription>{t.settings.security.dialogDescription}</DialogDescription>
        </DialogHeader>
        {open && (
          <ChangePasswordForm
            key={open ? "open" : "closed"}
            idPrefix="navbar-change-password"
            onSuccess={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
