"use client";

import { useMemo, useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { HomeSettingsCard } from "@/components/home-promos/HomeSettingsCard";
import { PromoFormDialog } from "@/components/home-promos/PromoFormDialog";
import { PromoRow } from "@/components/home-promos/PromoRow";
import { promoErrorMessage } from "@/components/home-promos/promoForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { ApiError } from "@/services/api/apiClient";
import { homePromoService } from "@/services/api/homePromoService";
import {
  HOME_PROMO_KINDS,
  HOME_PHONE_HERO_MAX_PROMOS,
  HOME_PROMOS_PER_KIND_MAX,
  type HomePromo,
  type HomePromoKind,
} from "@/types/home-promo";

/** Codes that mean "what you are looking at is stale" — the list is reloaded. */
const STALE_CODES = new Set(["HOME_PROMO_NOT_FOUND", "HOME_PROMO_REORDER_MISMATCH"]);

const byPosition = (a: HomePromo, b: HomePromo) =>
  a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);

/**
 * "Home promos" (2026-10-08): what the apps' home page promotes. Three
 * ordered lists — hero slides, spotlights, coming-soon cards — plus the one
 * settings row (web address, store links, games teaser). HOME.VIEW reads,
 * HOME.MANAGE changes; the backend audits every change and refreshes the
 * apps' cached home page at once.
 *
 * The content lives under the permission gate (like the audit page), so a
 * staff member without HOME.VIEW never calls the promos API at all.
 */
function HomePromosContent() {
  const { t, language } = useLanguage();
  const { can } = useRole();
  const canManage = can("HOME.MANAGE");
  const h = t.homePromos;

  const { data, isLoading, error, refetch } = useAsyncData(() => homePromoService.getPromos(), []);
  // What the server last told us after a change, on top of the loaded list —
  // so a save or a reorder shows at once without a full reload.
  const [local, setLocal] = useState<HomePromo[] | null>(null);
  const promos = useMemo(() => local ?? data ?? [], [local, data]);

  const byKind = useMemo(() => {
    const groups = Object.fromEntries(HOME_PROMO_KINDS.map((kind) => [kind, [] as HomePromo[]])) as Record<
      HomePromoKind,
      HomePromo[]
    >;
    for (const promo of promos) groups[promo.kind]?.push(promo);
    for (const kind of HOME_PROMO_KINDS) groups[kind].sort(byPosition);
    return groups;
  }, [promos]);

  const fullKinds = HOME_PROMO_KINDS.filter((kind) => byKind[kind].length >= HOME_PROMOS_PER_KIND_MAX);
  const liveHeroCount = byKind.HERO.filter((p) => p.liveState === "LIVE").length;

  const [tab, setTab] = useState<HomePromoKind>("HERO");
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<HomePromo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HomePromo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyKind, setBusyKind] = useState<HomePromoKind | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const reload = () => {
    setLocal(null);
    refetch();
  };

  /** Reports a refused change; a stale list is reloaded so the next try works. */
  const fail = (title: string, err: unknown) => {
    toast.error(title, { description: promoErrorMessage(err, t) });
    if (err instanceof ApiError && err.code && STALE_CODES.has(err.code)) reload();
  };

  const replace = (saved: HomePromo) =>
    setLocal((prev) => {
      const list = prev ?? data ?? [];
      return list.some((p) => p.id === saved.id)
        ? list.map((p) => (p.id === saved.id ? saved : p))
        : [...list, saved];
    });

  const openCreate = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  const openEdit = (promo: HomePromo) => {
    setEditing(promo);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  const handleSaved = (saved: HomePromo) => {
    replace(saved);
    setTab(saved.kind);
  };

  const handleToggleActive = async (promo: HomePromo, isActive: boolean) => {
    setBusyKind(promo.kind);
    try {
      replace(await homePromoService.updatePromo(promo.id, { isActive }));
      toast.success(h.updatedToast);
    } catch (err) {
      fail(h.saveFailedToast, err);
    } finally {
      setBusyKind(null);
    }
  };

  /** Sends the whole list of one kind in its new order (the backend refuses a partial list). */
  const saveOrder = async (kind: HomePromoKind, ids: string[]) => {
    const current = byKind[kind].map((p) => p.id);
    if (ids.every((id, i) => id === current[i])) return;
    const position = new Map(ids.map((id, i) => [id, i]));
    // Show the new order straight away; the server's answer replaces it.
    setLocal(promos.map((p) => (p.kind === kind ? { ...p, sortOrder: position.get(p.id) ?? p.sortOrder } : p)));
    setBusyKind(kind);
    try {
      const saved = await homePromoService.reorderPromos(kind, ids);
      setLocal((prev) => [...(prev ?? promos).filter((p) => p.kind !== kind), ...saved]);
      toast.success(h.reorderedToast);
    } catch (err) {
      fail(h.reorderFailedToast, err);
      if (!(err instanceof ApiError && err.code && STALE_CODES.has(err.code))) reload();
    } finally {
      setBusyKind(null);
    }
  };

  const handleMove = (kind: HomePromoKind, index: number, direction: -1 | 1) => {
    const ids = byKind[kind].map((p) => p.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void saveOrder(kind, ids);
  };

  const handleDrop = (kind: HomePromoKind, targetId: string) => {
    const dragged = dragId;
    setDragId(null);
    setOverId(null);
    if (!dragged || dragged === targetId) return;
    const ids = byKind[kind].map((p) => p.id);
    const from = ids.indexOf(dragged);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragged);
    void saveOrder(kind, ids);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await homePromoService.deletePromo(deleteTarget.id);
      const goneId = deleteTarget.id;
      setLocal((prev) => (prev ?? data ?? []).filter((p) => p.id !== goneId));
      toast.success(h.deletedToast);
      setDeleteTarget(null);
    } catch (err) {
      fail(h.deleteFailedToast, err);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const defaultKind = fullKinds.includes(tab)
    ? HOME_PROMO_KINDS.find((kind) => !fullKinds.includes(kind)) ?? tab
    : tab;
  const allFull = fullKinds.length === HOME_PROMO_KINDS.length;

  const newButton = canManage && (
    <Button onClick={openCreate} disabled={allFull || isLoading || !!error}>
      <Plus className="size-4" />
      {h.newPromo}
    </Button>
  );

  return (
    <div>
      <PageHeader title={h.title} description={h.description} actions={newButton} />
      {!canManage && <p className="-mt-3 mb-4 text-sm text-muted-foreground">{h.readOnly}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          {error ? (
            <ErrorState description={h.loadError} onRetry={reload} />
          ) : (
            <Tabs value={tab} onValueChange={(value) => setTab(value as HomePromoKind)}>
              <TabsList>
                {HOME_PROMO_KINDS.map((kind) => (
                  <TabsTrigger key={kind} value={kind} className="px-3">
                    {h.kinds[kind]}
                    {!isLoading && (
                      <span className="tabular-nums text-xs text-muted-foreground">{byKind[kind].length}</span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {HOME_PROMO_KINDS.map((kind) => {
                const list = byKind[kind];
                return (
                  <TabsContent key={kind} value={kind} className="mt-2 flex flex-col gap-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <p className="max-w-2xl text-sm text-muted-foreground">{h.kindHelp[kind]}</p>
                      {!isLoading && (
                        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {h.countOfMax(list.length, HOME_PROMOS_PER_KIND_MAX)}
                        </p>
                      )}
                    </div>
                    {fullKinds.includes(kind) && canManage && (
                      <p className="text-sm text-warning">{h.listFull(HOME_PROMOS_PER_KIND_MAX)}</p>
                    )}
                    {kind === "HERO" && liveHeroCount > HOME_PHONE_HERO_MAX_PROMOS && (
                      <p className="text-sm text-warning">{h.phoneHeroCap(HOME_PHONE_HERO_MAX_PROMOS)}</p>
                    )}

                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)
                    ) : list.length === 0 ? (
                      <EmptyState
                        icon={Megaphone}
                        title={h.emptyTitle}
                        description={h.emptyDescription[kind]}
                        action={
                          canManage &&
                          !fullKinds.includes(kind) && (
                            <Button onClick={openCreate}>
                              <Plus className="size-4" />
                              {h.newPromo}
                            </Button>
                          )
                        }
                      />
                    ) : (
                      list.map((promo, index) => (
                        <PromoRow
                          key={promo.id}
                          promo={promo}
                          index={index}
                          count={list.length}
                          canManage={canManage}
                          busy={busyKind === kind}
                          dragging={dragId === promo.id}
                          dropTarget={!!dragId && overId === promo.id && dragId !== promo.id}
                          onMove={(direction) => handleMove(kind, index, direction)}
                          onToggleActive={(active) => handleToggleActive(promo, active)}
                          onEdit={() => openEdit(promo)}
                          onDelete={() => setDeleteTarget(promo)}
                          onDragStart={() => setDragId(promo.id)}
                          onDragEnter={() => setOverId(promo.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverId(null);
                          }}
                          onDrop={() => handleDrop(kind, promo.id)}
                        />
                      ))
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </div>

        <div className="min-w-0">
          <HomeSettingsCard canManage={canManage} />
        </div>
      </div>

      {canManage && formOpen && (
        <PromoFormDialog
          key={formKey}
          open={formOpen}
          onOpenChange={setFormOpen}
          promo={editing}
          defaultKind={defaultKind}
          fullKinds={fullKinds}
          onSaved={handleSaved}
          onStale={reload}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
        title={h.deleteTitle}
        description={
          deleteTarget
            ? h.deleteDescription(language === "mm" ? deleteTarget.titleMm : deleteTarget.titleEn)
            : ""
        }
        confirmLabel={t.common.delete}
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function HomePromosPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission permission="HOME.VIEW" title={t.homePromos.title} description={t.homePromos.description}>
      <HomePromosContent />
    </RequirePermission>
  );
}
