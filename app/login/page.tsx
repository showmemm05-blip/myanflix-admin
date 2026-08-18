"use client";

import { useState, type FormEvent } from "react";
import { Clapperboard, Languages, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { ApiError } from "@/services/api/apiClient";

export default function LoginPage() {
  const { login } = useRole();
  const { t, language, setLanguage } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.login.genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4"
              aria-label={t.language.switcherLabel}
              title={t.language.switcherLabel}
            />
          }
        >
          <Languages className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setLanguage("en")} className={language === "en" ? "font-semibold" : undefined}>
              English
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("mm")} className={language === "mm" ? "font-semibold" : undefined}>
              မြန်မာ
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground glow-primary">
            <Clapperboard className="size-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gradient-brand">MyanFlix</span>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t.login.title}</CardTitle>
            <CardDescription>{t.login.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="username">{t.login.username}</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.login.usernamePlaceholder}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">{t.login.password}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" disabled={isSubmitting} className="mt-1">
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isSubmitting ? t.login.signingIn : t.login.signIn}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
