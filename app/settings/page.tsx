"use client";

import { useState } from "react";
import { Moon, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/lib/context/role-context";
import { toast } from "sonner";
import { useLanguage } from "@/lib/context/language-context";

export default function SettingsPage() {
  const { t } = useLanguage();
  const { currentUser, role, roleName, can, canAny } = useRole();
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone ?? "");

  // Each notification toggle is offered only to someone who can actually act
  // on what it announces — the alert is worthless otherwise.
  const canReviewPayments = canAny(["DEPOSITS.VIEW", "WITHDRAWALS.VIEW"]);
  const canReviewUsers = can("USERS.VIEW");
  const canManageContent = can("MOVIES.VIEW");

  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [newUserAlerts, setNewUserAlerts] = useState(true);
  const [contentAlerts, setContentAlerts] = useState(true);

  const handleSaveProfile = () => {
    toast.success(t.settings.profile.updatedToast, { description: t.settings.profile.updatedDescription });
  };

  const handleSaveNotifications = () => {
    toast.success(t.settings.notifications.savedToast);
  };

  return (
    <RequirePermission
      permission="SETTINGS.VIEW"
      title={t.settings.page.title}
      description={t.settings.page.description}
    >
      <div>
      <PageHeader title={t.settings.page.title} description={t.settings.page.description} />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t.settings.tabs.profile}</TabsTrigger>
          <TabsTrigger value="notifications">{t.settings.tabs.notifications}</TabsTrigger>
          <TabsTrigger value="appearance">{t.settings.tabs.appearance}</TabsTrigger>
          <TabsTrigger value="security">{t.settings.tabs.security}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card className="glass-card max-w-2xl">
            <CardHeader>
              <CardTitle>{t.settings.profile.cardTitle}</CardTitle>
              <CardDescription>{t.settings.profile.cardDescription}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-16 border border-border">
                  <AvatarImage src={currentUser.avatarUrl ?? undefined} alt={currentUser.name} />
                  <AvatarFallback>{currentUser.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <RoleBadge role={role} label={roleName} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.settings.profile.roleNote}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="settings-name">{t.settings.profile.fullNameLabel}</Label>
                  <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="settings-phone">{t.settings.profile.phoneLabel}</Label>
                  <Input
                    id="settings-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Button onClick={handleSaveProfile}>{t.settings.profile.saveChanges}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card className="glass-card max-w-2xl">
            <CardHeader>
              <CardTitle>{t.settings.notifications.cardTitle}</CardTitle>
              <CardDescription>{t.settings.notifications.cardDescription}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {canReviewPayments && (
                <div className="flex items-center justify-between py-3 first:pt-0">
                  <div>
                    <p className="text-sm font-medium">{t.settings.notifications.paymentAlertsLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.settings.notifications.paymentAlertsDescription}
                    </p>
                  </div>
                  <Switch checked={paymentAlerts} onCheckedChange={setPaymentAlerts} />
                </div>
              )}
              {canReviewUsers && (
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{t.settings.notifications.newUserAlertsLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.settings.notifications.newUserAlertsDescription}
                    </p>
                  </div>
                  <Switch checked={newUserAlerts} onCheckedChange={setNewUserAlerts} />
                </div>
              )}
              <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{t.settings.notifications.contentAlertsLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {canManageContent
                      ? t.settings.notifications.contentAlertsDescriptionStaff
                      : t.settings.notifications.contentAlertsDescriptionUser}
                  </p>
                </div>
                <Switch checked={contentAlerts} onCheckedChange={setContentAlerts} />
              </div>
              <div className="pt-4">
                <Button onClick={handleSaveNotifications}>{t.settings.notifications.savePreferences}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <Card className="glass-card max-w-2xl">
            <CardHeader>
              <CardTitle>{t.settings.appearance.cardTitle}</CardTitle>
              <CardDescription>{t.settings.appearance.cardDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Moon className="size-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.settings.appearance.darkThemeLabel}</p>
                    <p className="text-xs text-muted-foreground">{t.settings.appearance.darkThemeDescription}</p>
                  </div>
                </div>
                <Switch checked disabled />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card className="glass-card max-w-2xl">
            <CardHeader>
              <CardTitle>{t.settings.security.cardTitle}</CardTitle>
              <CardDescription>{t.settings.security.cardDescription}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                {t.settings.security.previewNotice}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="current-password">{t.settings.security.currentPasswordLabel}</Label>
                <Input id="current-password" type="password" placeholder="••••••••" disabled />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-password">{t.settings.security.newPasswordLabel}</Label>
                  <Input id="new-password" type="password" placeholder="••••••••" disabled />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-password">{t.settings.security.confirmPasswordLabel}</Label>
                  <Input id="confirm-password" type="password" placeholder="••••••••" disabled />
                </div>
              </div>
              <div>
                <Button disabled>{t.settings.security.updatePassword}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
      </div>
    </RequirePermission>
  );
}
