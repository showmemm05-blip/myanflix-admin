"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketFrameCard } from "@/components/lottery/TicketFrameCard";
import { formatRate, isTicketPrice, lotteryErrorMessage } from "@/components/lottery/drawFormat";
import { groupsSummaryText, isHttpUrl } from "@/components/lottery/resultsFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { salesCloseOnDrawDay } from "@/lib/myanmar-time";
import { lotteryService } from "@/services/api/lotteryService";
import { uploadService } from "@/services/api/uploadService";
import {
  LOTTERY_LIMITS,
  type LotteryResultsSourceTest,
  type LotterySettings,
  type UpdateLotterySettingsInput,
} from "@/types/lottery";

/** The Baht amount the exchange-rate example line is worked for. */
const EXAMPLE_BAHT = 2000;

/** The draw the sample ticket on the frame card prints — the design boards' example (its price follows the form). */
const SAMPLE_DRAW = { drawNo: 24, thaiDrawDate: "2026-10-31" } as const;

/** A rate as typed: digits, with at most the backend's four decimals. */
const RATE_PATTERN = new RegExp(`^\\d+(?:\\.\\d{1,${LOTTERY_LIMITS.exchangeRateDecimals}})?$`);

/**
 * The Lottery "Settings" page (2026-10-19): the single settings row behind
 * every draw — ticket price, tickets per number, the exchange rate for
 * prizes and the closing offset before the Thai draw. LOTTERY.VIEW reads
 * it, LOTTERY.SETTINGS_MANAGE saves it; the backend audits every change.
 *
 * Price, per-number limit and the ticket frame are COPIED into a draw when
 * it is created, so saving here never changes a draw already on sale — the
 * copy says so. The frame (2026-10-19) is uploaded on Save, purpose
 * "lottery_frame", like the dialogs' pictures; null = the apps' built-in.
 * The results source (phase 3) is the URL the winning numbers are fetched
 * from after each draw — empty = entered by hand; "Test the source" calls
 * the SAVED URL once (LOTTERY.RESULTS_PUBLISH) and shows what it answered.
 * The prize claim deadline (2026-10-24) is how many days after publishing a
 * winner can still request their prize; it is copied into a draw when it
 * is published.
 */
function LotterySettingsContent() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canManage = can("LOTTERY.SETTINGS_MANAGE");
  const canPublish = can("LOTTERY.RESULTS_PUBLISH");
  const s = t.lottery.settings;
  const rs = s.resultsSource;

  const { data, isLoading, error, refetch } = useAsyncData(() => lotteryService.getSettings(), []);

  // Overrides start out unset (null) so the inputs render whatever `data`
  // just loaded; once the admin types into a field, its override takes
  // over. `savedSettings` replaces `data` as the source of truth right
  // after a successful save, without waiting on a refetch.
  const [savedSettings, setSavedSettings] = useState<LotterySettings | null>(null);
  const [priceOverride, setPriceOverride] = useState<string | null>(null);
  const [maxOverride, setMaxOverride] = useState<string | null>(null);
  const [rateOverride, setRateOverride] = useState<string | null>(null);
  const [minutesOverride, setMinutesOverride] = useState<string | null>(null);
  const [deadlineOverride, setDeadlineOverride] = useState<string | null>(null);
  /**
   * The frame as the form holds it: null = untouched (the stored one),
   * `{ url: null }` = removed (back to the built-in), `{ url }` = uploaded
   * already (kept when the PATCH after it is refused, so the next Save does
   * not upload the same file again).
   */
  const [frameOverride, setFrameOverride] = useState<{ url: string | null } | null>(null);
  /** A picked frame file, uploaded on Save. */
  const [frameFile, setFrameFile] = useState<File | null>(null);
  const [urlOverride, setUrlOverride] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** The last "Test the source" answer, cleared when the URL is edited. */
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LotteryResultsSourceTest | null>(null);

  const settings = savedSettings ?? data;
  const frameUrl = frameOverride ? frameOverride.url : (settings?.frameUrl ?? null);
  const price = priceOverride ?? (settings ? String(settings.ticketPrice) : "");
  const max = maxOverride ?? (settings ? String(settings.maxPerNumber) : "");
  const rate = rateOverride ?? (settings ? String(settings.exchangeRate) : "");
  const minutes = minutesOverride ?? (settings ? String(settings.salesCloseMinutesBefore) : "");
  const deadline = deadlineOverride ?? (settings ? String(settings.claimDeadlineDays) : "");
  const url = urlOverride ?? (settings?.resultsUrl ?? "");
  /** Empty = fetching off (null on the wire). */
  const urlValue = url.trim() === "" ? null : url.trim();
  const urlDirty = urlValue !== (settings?.resultsUrl ?? null);

  const priceNumber = Number(price);
  const maxNumber = Number(max);
  const rateNumber = Number(rate);
  const minutesNumber = Number(minutes);
  const deadlineNumber = Number(deadline);
  const { min: maxMin, max: maxMax } = LOTTERY_LIMITS.maxPerNumber;
  const { min: minutesMin, max: minutesMax } = LOTTERY_LIMITS.salesCloseMinutesBefore;
  const { min: deadlineMin, max: deadlineMax } = LOTTERY_LIMITS.claimDeadlineDays;

  const invalid = {
    price: !isTicketPrice(price),
    max: !(Number.isInteger(maxNumber) && maxNumber >= maxMin && maxNumber <= maxMax),
    rate: !(RATE_PATTERN.test(rate.trim()) && rateNumber > 0),
    minutes: !(Number.isInteger(minutesNumber) && minutesNumber >= minutesMin && minutesNumber <= minutesMax),
    deadline: !(Number.isInteger(deadlineNumber) && deadlineNumber >= deadlineMin && deadlineNumber <= deadlineMax),
    url: urlValue !== null && !isHttpUrl(urlValue),
  };
  const canSave = !invalid.price && !invalid.max && !invalid.rate && !invalid.minutes && !invalid.deadline && !invalid.url;

  // The two worked examples under the fields, from what is typed right now.
  const exampleKs = invalid.rate ? null : (EXAMPLE_BAHT * rateNumber).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const closing = invalid.minutes ? null : salesCloseOnDrawDay(minutesNumber);

  const handleSave = async () => {
    if (!settings) return;
    setSaveError(null);
    setSaving(true);
    try {
      let nextFrameUrl = frameUrl;
      const file = frameFile;
      if (file) {
        nextFrameUrl = (await uploadService.uploadImage(file, "lottery_frame")).url;
        // Keep the uploaded copy: if the save below is refused, the next
        // Save reuses it instead of uploading the same frame again.
        setFrameOverride({ url: nextFrameUrl });
        setFrameFile((prev) => (prev === file ? null : prev));
      }

      // PATCH semantics — only what differs from the stored row is sent.
      const changed: UpdateLotterySettingsInput = {};
      if (priceNumber !== settings.ticketPrice) changed.ticketPrice = priceNumber;
      if (maxNumber !== settings.maxPerNumber) changed.maxPerNumber = maxNumber;
      if (rateNumber !== settings.exchangeRate) changed.exchangeRate = rateNumber;
      if (minutesNumber !== settings.salesCloseMinutesBefore) changed.salesCloseMinutesBefore = minutesNumber;
      if (deadlineNumber !== settings.claimDeadlineDays) changed.claimDeadlineDays = deadlineNumber;
      if (nextFrameUrl !== settings.frameUrl) changed.frameUrl = nextFrameUrl;
      if (urlDirty) changed.resultsUrl = urlValue;
      const saved = Object.keys(changed).length > 0 ? await lotteryService.updateSettings(changed) : settings;
      setSavedSettings(saved);
      setPriceOverride(null);
      setMaxOverride(null);
      setRateOverride(null);
      setMinutesOverride(null);
      setDeadlineOverride(null);
      setFrameOverride(null);
      setFrameFile(null);
      setUrlOverride(null);
      toast.success(s.updatedToast);
    } catch (err) {
      setSaveError(lotteryErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  // Calls the SAVED URL — the test is of what the cron will use, so an
  // unsaved edit disables the button and the hint says to save first.
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await lotteryService.testResultsSource());
    } catch (err) {
      toast.error(rs.testFailedToast, { description: lotteryErrorMessage(err, t) });
    } finally {
      setTesting(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader title={s.title} description={s.description} />
        <ErrorState description={s.loadError} onRetry={refetch} />
      </div>
    );
  }

  const disabled = saving || !canManage;

  return (
    <div>
      <PageHeader title={s.title} description={s.description} />
      {!canManage && <p className="-mt-3 mb-4 text-sm text-muted-foreground">{s.readOnly}</p>}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{s.ticketsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ticket-price">{s.ticketPriceLabel}</Label>
                  <Input
                    id="ticket-price"
                    type="number"
                    min="1"
                    step="100"
                    value={price}
                    disabled={disabled}
                    aria-invalid={invalid.price}
                    className="tabular-nums"
                    onChange={(e) => setPriceOverride(e.target.value)}
                  />
                  {invalid.price && <p className="text-xs text-destructive">{s.invalid.ticketPrice}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="max-per-number">{s.maxPerNumberLabel}</Label>
                  <Input
                    id="max-per-number"
                    type="number"
                    min={maxMin}
                    max={maxMax}
                    step="1"
                    value={max}
                    disabled={disabled}
                    aria-invalid={invalid.max}
                    className="tabular-nums"
                    onChange={(e) => setMaxOverride(e.target.value)}
                  />
                  <p className={invalid.max ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                    {invalid.max ? s.invalid.maxPerNumber(maxMin, maxMax) : s.maxPerNumberHint}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{s.copiedNote}</p>
            </CardContent>
          </Card>

          <TicketFrameCard
            frameUrl={frameUrl}
            pickedFile={frameFile}
            sampleDraw={{ ...SAMPLE_DRAW, ticketPrice: invalid.price ? (settings?.ticketPrice ?? 0) : priceNumber }}
            disabled={disabled}
            canManage={canManage}
            onPick={setFrameFile}
            onRemove={() => {
              setFrameFile(null);
              setFrameOverride({ url: null });
            }}
          />

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{s.prizesTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="exchange-rate">{s.exchangeRateLabel}</Label>
                  <Input
                    id="exchange-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={rate}
                    disabled={disabled}
                    aria-invalid={invalid.rate}
                    className="tabular-nums"
                    onChange={(e) => setRateOverride(e.target.value)}
                  />
                  <p className={invalid.rate ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                    {invalid.rate ? s.invalid.exchangeRate(LOTTERY_LIMITS.exchangeRateDecimals) : s.exchangeRateHint}
                  </p>
                </div>
                <div className="flex flex-col justify-end gap-1.5">
                  <p className="text-sm font-medium tabular-nums">
                    {exampleKs !== null
                      ? s.exchangeExample(EXAMPLE_BAHT.toLocaleString("en-US"), formatRate(rateNumber), exampleKs)
                      : "—"}
                  </p>
                </div>
                {/* How long a winner has to request a prize (2026-10-24); copied into a draw when it is published. */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="claim-deadline-days">{s.claimDeadlineLabel}</Label>
                  <Input
                    id="claim-deadline-days"
                    type="number"
                    min={deadlineMin}
                    max={deadlineMax}
                    step="1"
                    value={deadline}
                    disabled={disabled}
                    aria-invalid={invalid.deadline}
                    className="tabular-nums"
                    onChange={(e) => setDeadlineOverride(e.target.value)}
                  />
                  <p className={invalid.deadline ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                    {invalid.deadline ? s.invalid.claimDeadline(deadlineMin, deadlineMax) : s.claimDeadlineHint}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{rs.title}</CardTitle>
              <CardDescription>{rs.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="results-url">{rs.urlLabel}</Label>
                <Input
                  id="results-url"
                  type="url"
                  inputMode="url"
                  placeholder={rs.urlPlaceholder}
                  value={url}
                  disabled={disabled}
                  aria-invalid={invalid.url}
                  className="font-mono text-sm"
                  onChange={(e) => {
                    setUrlOverride(e.target.value);
                    setTestResult(null);
                  }}
                />
                <p className={invalid.url ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                  {invalid.url ? rs.urlInvalid : rs.urlHint}
                </p>
              </div>
              {settings?.resultsUrl === null && !urlDirty && (
                <p className="text-xs text-muted-foreground">{rs.offLine}</p>
              )}
              {canPublish && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testing || saving || urlDirty || !settings?.resultsUrl}
                      onClick={handleTest}
                    >
                      {testing && <Loader2 className="size-4 animate-spin" />}
                      {testing ? rs.testing : rs.test}
                    </Button>
                    {urlDirty && <p className="text-xs text-muted-foreground">{rs.testUnsaved}</p>}
                  </div>
                  {testResult && (
                    <div
                      className={
                        testResult.ok
                          ? "rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-sm"
                          : "rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm"
                      }
                    >
                      <p className="font-medium">
                        {testResult.ok
                          ? testResult.sourceDate
                            ? rs.testOk(testResult.sourceDate)
                            : rs.testOkNoDate
                          : rs.testFailed}
                      </p>
                      {testResult.ok && groupsSummaryText(testResult.groupsSummary, t) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {rs.testGroups(groupsSummaryText(testResult.groupsSummary, t) ?? "")}
                        </p>
                      )}
                      {/* The backend's own sentences (near-first not ±1 …), shown as sent. */}
                      {testResult.warnings?.map((warning) => (
                        <p key={warning} className="mt-0.5 text-xs text-warning">
                          {warning}
                        </p>
                      ))}
                      {testResult.error && <p className="mt-0.5 text-xs text-destructive">{testResult.error}</p>}
                      {/* The address actually asked, after the {date} replacement — what to check when the answer looks wrong. */}
                      {testResult.url && (
                        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={testResult.url}>
                          {testResult.url}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{s.closingTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="close-minutes">{s.closeMinutesLabel}</Label>
                  <Input
                    id="close-minutes"
                    type="number"
                    min={minutesMin}
                    max={minutesMax}
                    step="1"
                    value={minutes}
                    disabled={disabled}
                    aria-invalid={invalid.minutes}
                    className="tabular-nums"
                    onChange={(e) => setMinutesOverride(e.target.value)}
                  />
                  <p className={invalid.minutes ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                    {invalid.minutes ? s.invalid.closeMinutes(minutesMin, minutesMax) : s.closeMinutesHint}
                  </p>
                </div>
                <div className="flex flex-col justify-end gap-1.5">
                  <p className="text-sm font-medium tabular-nums">
                    {closing ? (closing.dayBefore ? s.closesAtDayBefore(closing.time) : s.closesAt(closing.time)) : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {settings?.updatedBy
                ? s.lastChanged(settings.updatedBy.label, format(new Date(settings.updatedAt), "d MMM yyyy, HH:mm:ss"))
                : s.neverChanged}
            </p>
            {canManage && (
              <Button onClick={handleSave} disabled={saving || !canSave}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving && frameFile ? s.frame.uploading : s.saveChanges}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LotterySettingsPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission permission="LOTTERY.VIEW" title={t.lottery.settings.title} description={t.lottery.settings.description}>
      <LotterySettingsContent />
    </RequirePermission>
  );
}
