"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Medal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LevelBadge, LEVEL_BADGE_ICONS } from "@/components/levels/LevelBadge";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { formatKyat } from "@/lib/currency";
import { levelService } from "@/services/api/levelService";
import { ApiError } from "@/services/api/apiClient";
import type { AppLevel } from "@/types/level";
import { toast } from "sonner";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * The membership ladder. Thresholds live here and nowhere else — a user's
 * level is resolved by the backend at read time from their approved-deposit
 * total, so an edit on this page re-ranks every user with no batch job.
 * Levels are user-domain configuration, hence USERS.VIEW/EDIT gating
 * (book-categories precedent: no new permission module).
 */
export default function UserLevelsPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canEdit = can("USERS.EDIT");

  const { data, isLoading, error, refetch } = useAsyncData(
    levelService.getAllLevels,
    [],
  );
  const levels = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.order - b.order),
    [data],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppLevel | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [thresholdInput, setThresholdInput] = useState("0");
  const [iconInput, setIconInput] = useState<string>(LEVEL_BADGE_ICONS[0]);
  const [colorInput, setColorInput] = useState("#F0B90B");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppLevel | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);

  const colorValid = HEX_COLOR.test(colorInput);
  const thresholdNumber = Number(thresholdInput);
  // Mirrors the DTO exactly (@IsNumber maxDecimalPlaces 2, @Min 0, @Max
  // 9999999999.99 — DECIMAL(12,2)): anything looser here turns into a raw
  // class-validator 400 in a toast instead of the disabled save button.
  const thresholdValid =
    thresholdInput.trim() !== "" &&
    Number.isFinite(thresholdNumber) &&
    thresholdNumber >= 0 &&
    thresholdNumber <= 9999999999.99 &&
    Math.round(thresholdNumber * 100) === thresholdNumber * 100;
  const canSave = !!nameInput.trim() && colorValid && thresholdValid;

  /**
   * The backend's 409 bodies are English sentences; both conflicts already
   * have translated keys, so match on status rather than string-compare a
   * message that may be reworded.
   */
  const conflictMessage = (err: unknown) => {
    if (err instanceof ApiError && err.status === 409) {
      return /threshold/i.test(err.message)
        ? t.levels.thresholdConflict
        : t.levels.nameConflict;
    }
    return err instanceof ApiError ? err.message : t.common.somethingWentWrong;
  };


  const openCreate = () => {
    setEditing(null);
    setNameInput("");
    setThresholdInput("0");
    setIconInput(LEVEL_BADGE_ICONS[0]);
    setColorInput("#F0B90B");
    setFormOpen(true);
  };

  const openEdit = (level: AppLevel) => {
    setEditing(level);
    setNameInput(level.name);
    setThresholdInput(String(level.threshold));
    setIconInput(level.icon);
    setColorInput(level.color);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editing) {
        // Send only what changed — the backend's duplicate checks exclude
        // self, but a minimal payload keeps the audit surface honest.
        const changed: Partial<{
          name: string;
          threshold: number;
          icon: string;
          color: string;
        }> = {};
        if (nameInput.trim() !== editing.name) changed.name = nameInput.trim();
        if (thresholdNumber !== editing.threshold)
          changed.threshold = thresholdNumber;
        if (iconInput !== editing.icon) changed.icon = iconInput;
        if (colorInput !== editing.color) changed.color = colorInput;
        if (Object.keys(changed).length > 0) {
          await levelService.updateLevel(editing.id, changed);
        }
        toast.success(t.levels.updatedToast);
      } else {
        // order omitted on purpose: the backend appends to the ladder.
        await levelService.createLevel({
          name: nameInput.trim(),
          threshold: thresholdNumber,
          icon: iconInput,
          color: colorInput,
        });
        toast.success(t.levels.createdToast);
      }
      setFormOpen(false);
      refetch();
    } catch (err) {
      toast.error(t.levels.saveFailedToast, {
        description: conflictMessage(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (level: AppLevel, enabled: boolean) => {
    try {
      await levelService.updateLevel(level.id, { enabled });
      toast.success(t.levels.updatedToast);
      refetch();
    } catch (err) {
      toast.error(t.levels.saveFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.common.somethingWentWrong,
      });
      // Refetch to snap the switch back to the server's truth.
      refetch();
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= levels.length) return;
    setReordering(true);
    try {
      const next = [...levels];
      [next[index], next[target]] = [next[target], next[index]];
      // Send the WHOLE ladder re-numbered from 1 — this also normalizes any
      // legacy gaps left by deletes.
      await levelService.reorderLevels(
        next.map((level, i) => ({ id: level.id, order: i + 1 })),
      );
      refetch();
    } catch (err) {
      toast.error(t.levels.reorderFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.common.somethingWentWrong,
      });
    } finally {
      setReordering(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await levelService.deleteLevel(deleteTarget.id);
      toast.success(t.levels.deletedToast);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(t.levels.deleteFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.common.somethingWentWrong,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <RequirePermission
      permission="USERS.VIEW"
      title={t.levels.title}
      description={t.levels.description}
    >
      {error ? (
        <div>
          <PageHeader
            title={t.levels.title}
            description={t.levels.description}
          />
          <ErrorState description={t.levels.loadError} onRetry={refetch} />
        </div>
      ) : (
        <div>
          <PageHeader
            title={t.levels.title}
            description={t.levels.description}
            actions={
              canEdit && (
                <Button onClick={openCreate}>
                  <Plus className="size-4" />
                  {t.levels.add}
                </Button>
              )
            }
          />

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] rounded-lg" />
              ))}
            </div>
          ) : levels.length === 0 ? (
            <EmptyState
              icon={Medal}
              title={t.levels.emptyTitle}
              description={t.levels.emptyDescription}
              action={
                canEdit && (
                  <Button onClick={openCreate}>
                    <Plus className="size-4" />
                    {t.levels.add}
                  </Button>
                )
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {levels.map((level, index) => (
                <Card
                  key={level.id}
                  className={`glass-card flex flex-row items-center gap-4 p-4 ${
                    level.enabled ? "" : "opacity-60"
                  }`}
                >
                  <LevelBadge icon={level.icon} color={level.color} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{level.name}</p>
                      {!level.enabled && (
                        <Badge variant="outline">
                          {t.levels.disabledBadge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatKyat(level.threshold)}+
                    </p>
                  </div>
                  {canEdit && (
                    <>
                      <Switch
                        checked={level.enabled}
                        onCheckedChange={(checked) =>
                          handleToggleEnabled(level, checked)
                        }
                        aria-label={t.levels.enabled}
                      />
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={reordering || index === 0}
                          onClick={() => handleMove(index, -1)}
                          aria-label={t.levels.moveUp}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={reordering || index === levels.length - 1}
                          onClick={() => handleMove(index, 1)}
                          aria-label={t.levels.moveDown}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>
                      <RowActions>
                        <RowActionButton
                          icon={Pencil}
                          label={t.common.edit}
                          onClick={() => openEdit(level)}
                        />
                        <RowActionButton
                          icon={Trash2}
                          label={t.common.delete}
                          destructive
                          onClick={() => setDeleteTarget(level)}
                        />
                      </RowActions>
                    </>
                  )}
                </Card>
              ))}
            </div>
          )}

          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing ? t.levels.editTitle : t.levels.addTitle}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                {/* Live preview — exactly what the user-facing badge renders */}
                <div className="flex items-center gap-4 rounded-lg border border-[var(--border-strong)] p-3">
                  <LevelBadge
                    icon={iconInput}
                    color={colorValid ? colorInput : "#8B909A"}
                    size={64}
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {t.levels.preview}
                    </p>
                    <p className="truncate font-semibold">
                      {nameInput.trim() || t.levels.namePlaceholder}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatKyat(thresholdValid ? thresholdNumber : 0)}+
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="level-name">{t.levels.name}</Label>
                  <Input
                    id="level-name"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder={t.levels.namePlaceholder}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="level-threshold">{t.levels.threshold}</Label>
                  <Input
                    id="level-threshold"
                    type="number"
                    min={0}
                    step={100}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.levels.thresholdHint}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>{t.levels.icon}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {LEVEL_BADGE_ICONS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={iconInput === key}
                        onClick={() => setIconInput(key)}
                        className={`flex items-center justify-center rounded-lg border p-2 transition-colors ${
                          iconInput === key
                            ? "border-ring ring-2 ring-ring"
                            : "border-[var(--border-strong)] hover:bg-muted"
                        }`}
                      >
                        <LevelBadge
                          icon={key}
                          color={colorValid ? colorInput : "#8B909A"}
                          size={48}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="level-color">{t.levels.color}</Label>
                  <div className="flex items-center gap-2">
                    {/* Native picker and hex field stay in sync both ways */}
                    <input
                      type="color"
                      value={colorValid ? colorInput : "#8B909A"}
                      onChange={(e) => setColorInput(e.target.value)}
                      className="size-9 shrink-0 cursor-pointer rounded-md border border-[var(--border-strong)] bg-transparent p-1"
                      aria-label={t.levels.color}
                    />
                    <Input
                      id="level-color"
                      value={colorInput}
                      onChange={(e) => setColorInput(e.target.value)}
                      placeholder="#F0B90B"
                      className="font-mono"
                    />
                  </div>
                  {!colorValid && (
                    <p className="text-xs text-destructive">
                      {t.levels.colorInvalid}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                >
                  {t.common.cancel}
                </Button>
                <Button onClick={handleSave} disabled={saving || !canSave}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {editing ? t.common.save : t.common.add}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
            title={t.levels.deleteTitle}
            description={
              deleteTarget
                ? t.levels.deleteDescription(deleteTarget.name)
                : ""
            }
            confirmLabel={t.common.delete}
            variant="destructive"
            loading={deleting}
            onConfirm={handleDelete}
          />
        </div>
      )}
    </RequirePermission>
  );
}
