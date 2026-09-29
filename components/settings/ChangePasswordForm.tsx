"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/context/language-context";
import { ApiError } from "@/services/api/apiClient";
import { userService } from "@/services/api/userService";
import { toast } from "sonner";

/** Mirrors the backend DTO (`newPassword` min 8) so the button only lights up for a request that can succeed. */
const MIN_PASSWORD = 8;

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  disabled: boolean;
  autoComplete: "current-password" | "new-password";
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The signed-in staff member's own password change, against
 * `PATCH /users/me/password`. Shared by the navbar dialog (every staff role)
 * and the Settings › Security card (SETTINGS.VIEW only), so `idPrefix` keeps
 * the two sets of element ids apart should both ever be mounted at once.
 */
export function ChangePasswordForm({
  onSuccess,
  submitLabel,
  idPrefix = "change-password",
}: {
  onSuccess?: () => void;
  submitLabel?: string;
  idPrefix?: string;
}) {
  const { t } = useLanguage();
  const copy = t.settings.security;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline hints appear only once the user has typed in that field — an
  // empty form is not wrong yet, it is just not finished.
  const newPasswordError =
    newPassword.length === 0
      ? null
      : newPassword.length < MIN_PASSWORD
        ? copy.tooShort
        : newPassword === currentPassword
          ? copy.sameAsCurrent
          : null;
  const confirmPasswordError =
    confirmPassword.length > 0 && confirmPassword !== newPassword ? copy.mismatch : null;

  const valid =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD &&
    newPassword !== currentPassword &&
    confirmPassword === newPassword;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || saving) return;
    setError(null);
    setCurrentPasswordError(null);
    setSaving(true);
    try {
      await userService.changeMyPassword(currentPassword, newPassword);
      toast.success(copy.updatedToast, { description: copy.updatedDescription });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onSuccess?.();
    } catch (err) {
      // The backend's own "Your current password is incorrect" belongs on the
      // field it is about, localized; anything else stays a form-level alert.
      const message = err instanceof ApiError ? err.message : null;
      if (message && /current password/i.test(message)) {
        setCurrentPasswordError(copy.currentIncorrect);
      } else {
        setError(message ?? copy.updateFailed);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <PasswordField
        id={`${idPrefix}-current-password`}
        label={copy.currentPasswordLabel}
        value={currentPassword}
        onChange={(value) => {
          setCurrentPassword(value);
          setCurrentPasswordError(null);
        }}
        error={currentPasswordError}
        disabled={saving}
        autoComplete="current-password"
      />
      <PasswordField
        id={`${idPrefix}-new-password`}
        label={copy.newPasswordLabel}
        value={newPassword}
        onChange={setNewPassword}
        error={newPasswordError}
        disabled={saving}
        autoComplete="new-password"
      />
      <PasswordField
        id={`${idPrefix}-confirm-password`}
        label={copy.confirmPasswordLabel}
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={confirmPasswordError}
        disabled={saving}
        autoComplete="new-password"
      />
      <div>
        <Button type="submit" disabled={!valid || saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {submitLabel ?? copy.updatePassword}
        </Button>
      </div>
    </form>
  );
}
