"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Check, ImageIcon, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ApiError } from "@/services/api/apiClient";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import { uploadService } from "@/services/api/uploadService";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import type { PaymentAccountType } from "@/types/payment-account";
import { toast } from "sonner";

/** Compact 40x40 click-to-upload logo picker used inline in each method row. */
function MethodLogoPicker({
  previewUrl,
  onPick,
  onRemove,
  disabled,
}: {
  previewUrl: string | null;
  onPick: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex size-10 items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/15 bg-secondary/20 transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {previewUrl ? (
          <Image src={previewUrl} alt="" width={40} height={40} className="size-full object-cover" unoptimized />
        ) : (
          <ImageIcon className="size-4 text-muted-foreground" />
        )}
      </button>
      {previewUrl && !disabled && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove logo"
          className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
        >
          <X className="size-2.5" />
        </button>
      )}
    </div>
  );
}

function PaymentMethodRow({
  type,
  accountCount,
  onSaved,
  onDeleted,
}: {
  type: PaymentAccountType;
  accountCount: number;
  onSaved: (updated: PaymentAccountType, previousLabel: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(type.label);
  const [requiresBankName, setRequiresBankName] = useState(type.requiresBankName);
  const [logoUrl, setLogoUrl] = useState(type.logoUrl);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const logoObjectUrl = useObjectUrl(logoFile);
  const logoPreview = logoObjectUrl ?? logoUrl;

  const cancelEdit = () => {
    setLabel(type.label);
    setRequiresBankName(type.requiresBankName);
    setLogoUrl(type.logoUrl);
    setLogoFile(null);
    setError(null);
    setEditing(false);
  };

  const handleSave = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setError(null);
    setSaving(true);
    try {
      const nextLogoUrl = logoFile ? (await uploadService.uploadImage(logoFile)).url : logoUrl;
      const updated = await paymentAccountService.updateType(type.id, {
        label: trimmed,
        requiresBankName,
        logoUrl: nextLogoUrl,
      });
      onSaved(updated, type.label);
      toast.success("Payment method updated", {
        description:
          trimmed !== type.label
            ? `Renamed to "${trimmed}" — every account using "${type.label}" now shows the new name.`
            : `"${trimmed}" was updated.`,
      });
      setLogoFile(null);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await paymentAccountService.deleteType(type.id);
      onDeleted(type.id);
      toast.success("Payment method deleted", { description: `"${type.label}" was removed.` });
      setConfirmDelete(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-input p-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-start gap-2">
          <MethodLogoPicker
            previewUrl={logoPreview}
            onPick={setLogoFile}
            onRemove={() => {
              setLogoFile(null);
              setLogoUrl(null);
            }}
            disabled={saving}
          />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus className="flex-1" />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={requiresBankName} onCheckedChange={setRequiresBankName} size="sm" />
            Requires bank name
          </label>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={cancelEdit} disabled={saving}>
              <X className="size-4" />
            </Button>
            <Button size="icon-sm" onClick={handleSave} disabled={saving || !label.trim()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-input p-3">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-secondary/20">
          {type.logoUrl ? (
            <Image src={type.logoUrl} alt="" width={40} height={40} className="size-full object-cover" unoptimized />
          ) : (
            <ImageIcon className="size-4 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium">{type.label}</p>
          <p className="text-xs text-muted-foreground">
            {type.requiresBankName ? "Requires bank name" : "No bank name"} ·{" "}
            {accountCount === 1 ? "1 account" : `${accountCount} accounts`}
          </p>
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this payment method?"
        description={
          accountCount > 0
            ? `"${type.label}" is used by ${accountCount} account(s). Delete or reassign them first.`
            : `"${type.label}" will be permanently removed from the picker. This action cannot be undone.`
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function AddMethodRow({ onCreated }: { onCreated: (created: PaymentAccountType) => void }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [requiresBankName, setRequiresBankName] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logoPreview = useObjectUrl(logoFile);

  const reset = () => {
    setLabel("");
    setRequiresBankName(false);
    setLogoFile(null);
    setError(null);
    setAdding(false);
  };

  const handleCreate = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setError(null);
    setSaving(true);
    try {
      const logoUrl = logoFile ? (await uploadService.uploadImage(logoFile)).url : undefined;
      const created = await paymentAccountService.createType({ label: trimmed, requiresBankName, logoUrl });
      onCreated(created);
      toast.success("Payment method added", { description: `"${trimmed}" is ready to use.` });
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!adding) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
        <Plus className="size-4" />
        Add payment method
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-input p-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-start gap-2">
        <MethodLogoPicker previewUrl={logoPreview} onPick={setLogoFile} onRemove={() => setLogoFile(null)} disabled={saving} />
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Wave Pay"
          autoFocus
          className="flex-1"
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={requiresBankName} onCheckedChange={setRequiresBankName} size="sm" />
          Requires bank name
        </label>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={reset} disabled={saving}>
            <X className="size-4" />
          </Button>
          <Button size="icon-sm" onClick={handleCreate} disabled={saving || !label.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ManagePaymentMethodsDialog({
  open,
  onOpenChange,
  types,
  accountCounts,
  onTypesChanged,
  onAccountsRenamed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: PaymentAccountType[];
  accountCounts: Record<string, number>;
  onTypesChanged: (types: PaymentAccountType[]) => void;
  onAccountsRenamed?: (previousLabel: string, nextLabel: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage payment methods</DialogTitle>
          <DialogDescription>
            Rename or remove the methods offered when adding a payment account. Renaming updates every
            account already using that method.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {types.map((type) => (
            <PaymentMethodRow
              key={type.id}
              type={type}
              accountCount={accountCounts[type.label] ?? 0}
              onSaved={(updated, previousLabel) => {
                onTypesChanged(types.map((t) => (t.id === updated.id ? updated : t)));
                if (updated.label !== previousLabel) {
                  onAccountsRenamed?.(previousLabel, updated.label);
                }
              }}
              onDeleted={(id) => onTypesChanged(types.filter((t) => t.id !== id))}
            />
          ))}

          <AddMethodRow onCreated={(created) => onTypesChanged([...types, created])} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
