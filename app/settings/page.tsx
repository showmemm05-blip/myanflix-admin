"use client";

import { useState } from "react";
import { Moon, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
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

export default function SettingsPage() {
  const { currentUser, role } = useRole();
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [newUserAlerts, setNewUserAlerts] = useState(role !== "USER");
  const [contentAlerts, setContentAlerts] = useState(true);

  const handleSaveProfile = () => {
    toast.success("Profile updated", { description: "Your changes have been saved." });
  };

  const handleSaveNotifications = () => {
    toast.success("Notification preferences saved");
  };

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account and platform preferences." />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card className="glass-card max-w-2xl border-white/[0.08]">
            <CardHeader>
              <CardTitle>Profile information</CardTitle>
              <CardDescription>Update your account details.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-16 border border-border">
                  <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                  <AvatarFallback>{currentUser.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <RoleBadge role={role} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Role changes are managed from Roles &amp; Permissions.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="settings-name">Full name</Label>
                  <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="settings-email">Email address</Label>
                  <Input
                    id="settings-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Button onClick={handleSaveProfile}>Save changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card className="glass-card max-w-2xl border-white/[0.08]">
            <CardHeader>
              <CardTitle>Notification preferences</CardTitle>
              <CardDescription>Choose what you want to be notified about.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-white/[0.08]">
              <div className="flex items-center justify-between py-3 first:pt-0">
                <div>
                  <p className="text-sm font-medium">Email alerts</p>
                  <p className="text-xs text-muted-foreground">Receive account activity by email</p>
                </div>
                <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
              </div>
              {role !== "USER" && (
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">Payment alerts</p>
                    <p className="text-xs text-muted-foreground">Get notified about new transactions</p>
                  </div>
                  <Switch checked={paymentAlerts} onCheckedChange={setPaymentAlerts} />
                </div>
              )}
              {role !== "USER" && (
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">New user signups</p>
                    <p className="text-xs text-muted-foreground">Alert when a new user registers</p>
                  </div>
                  <Switch checked={newUserAlerts} onCheckedChange={setNewUserAlerts} />
                </div>
              )}
              <div className="flex items-center justify-between py-3 last:pb-0">
                <div>
                  <p className="text-sm font-medium">Content updates</p>
                  <p className="text-xs text-muted-foreground">
                    {role === "USER"
                      ? "New releases in your favorite genres"
                      : "Upload, processing and publish status changes"}
                  </p>
                </div>
                <Switch checked={contentAlerts} onCheckedChange={setContentAlerts} />
              </div>
              <div className="pt-4">
                <Button onClick={handleSaveNotifications}>Save preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <Card className="glass-card max-w-2xl border-white/[0.08]">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>MyanFlix Admin is designed for a premium dark experience.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Moon className="size-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Dark theme</p>
                    <p className="text-xs text-muted-foreground">Locked for this admin dashboard</p>
                  </div>
                </div>
                <Switch checked disabled />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card className="glass-card max-w-2xl border-white/[0.08]">
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Password and authentication settings.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 p-3 text-sm text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                Authentication isn&apos;t connected yet in this preview build. These fields are for layout
                purposes only.
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="current-password">Current password</Label>
                <Input id="current-password" type="password" placeholder="••••••••" disabled />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <Input id="new-password" type="password" placeholder="••••••••" disabled />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input id="confirm-password" type="password" placeholder="••••••••" disabled />
                </div>
              </div>
              <div>
                <Button disabled>Update password</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
