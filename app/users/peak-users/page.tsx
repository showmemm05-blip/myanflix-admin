"use client";

/**
 * Peak Users — lives under People because the figure is ABOUT the audience
 * (highest concurrent viewers + the marketing adjustment), not about app
 * configuration. The card itself is shared with nothing else; this page is
 * just its People-tab home. Backend gate: PEAK_USERS_MANAGE (SUPER_ADMIN).
 */

import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { PeakUsersCard } from "@/components/settings/PeakUsersCard";
import { useLanguage } from "@/lib/context/language-context";

export default function PeakUsersPage() {
  const { t } = useLanguage();

  return (
    <RequirePermission
      permission="PEAK_USERS.VIEW"
      title={t.settings.peakUsers.cardTitle}
      description={t.settings.peakUsers.cardDescription}
    >
      <div className="space-y-5">
        <PageHeader
          title={t.settings.peakUsers.cardTitle}
          description={t.settings.peakUsers.cardDescription}
        />
        <div className="max-w-2xl">
          <PeakUsersCard />
        </div>
      </div>
    </RequirePermission>
  );
}
