"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { lotteryErrorMessage } from "@/components/lottery/drawFormat";
import {
  checkGroup,
  normalizeResults,
  parseNumbersInput,
  prizeGroupName,
  sheetGroups,
} from "@/components/lottery/resultsFormat";
import { useLanguage } from "@/lib/context/language-context";
import { formatDateOnly } from "@/lib/myanmar-time";
import { lotteryService } from "@/services/api/lotteryService";
import {
  LOTTERY_PRIZE_GROUP_DEFAULT_BAHT,
  LOTTERY_PRIZE_GROUP_KEYS,
  LOTTERY_PRIZE_GROUP_SHAPE,
  type EnterLotteryResultsInput,
  type LotteryAdminDraw,
  type LotteryDrawResults,
  type LotteryPrizeGroupKey,
} from "@/types/lottery";

/** A Baht amount as typed: digits, at most two decimals, zero allowed (a group the source paid nothing for). */
const BAHT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

type Texts = Record<LotteryPrizeGroupKey, string>;

interface EnterResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draw: LotteryAdminDraw;
  /** The record as it stands — its numbers and Baht seed the fields; null when nothing is stored yet. */
  results: LotteryDrawResults | null;
  onSaved: (results: LotteryDrawResults) => void;
}

/**
 * The winning numbers typed by hand, for when the source is down or wrong:
 * nine boxes, one per group, each checked live for its count, its digit
 * length and repeats; Next to 1st prize is warned (not refused) when it is
 * not the 1st prize ±1. Save sends all nine groups (PUT replaces the sheet)
 * and is allowed until the draw is published. The parent mounts it with a
 * `key` per opening, so the fields are seeded once from the stored record.
 */
export function EnterResultsDialog({ open, onOpenChange, draw, results, onSaved }: EnterResultsDialogProps) {
  const { t } = useLanguage();
  const r = t.lottery.draws.detail.results;
  const e = r.enter;
  const stored = sheetGroups(results?.groups ?? []);

  const [texts, setTexts] = useState<Texts>(
    () => Object.fromEntries(stored.map((g) => [g.key, g.numbers.join(" ")])) as Texts,
  );
  const [bahts, setBahts] = useState<Texts>(
    () =>
      Object.fromEntries(
        stored.map((g) => [g.key, String(g.baht > 0 ? g.baht : LOTTERY_PRIZE_GROUP_DEFAULT_BAHT[g.key])]),
      ) as Texts,
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showProblems, setShowProblems] = useState(false);

  const firstNumber = parseNumbersInput(texts.first)[0];
  const checks = Object.fromEntries(
    LOTTERY_PRIZE_GROUP_KEYS.map((key) => [key, checkGroup(key, texts[key], firstNumber)]),
  ) as Record<LotteryPrizeGroupKey, ReturnType<typeof checkGroup>>;
  const bahtOk = Object.fromEntries(
    LOTTERY_PRIZE_GROUP_KEYS.map((key) => [key, BAHT_PATTERN.test(bahts[key].trim())]),
  ) as Record<LotteryPrizeGroupKey, boolean>;
  const allOk = LOTTERY_PRIZE_GROUP_KEYS.every((key) => checks[key].ok && bahtOk[key]);

  const handleSave = async () => {
    if (!allOk) {
      setShowProblems(true);
      return;
    }
    setSaving(true);
    try {
      const input: EnterLotteryResultsInput = {
        groups: LOTTERY_PRIZE_GROUP_KEYS.map((key) => ({
          key,
          baht: Number(bahts[key].trim()),
          numbers: checks[key].numbers,
        })),
      };
      const trimmedNote = note.trim();
      if (trimmedNote) input.note = trimmedNote;
      const saved = await lotteryService.enterDrawResults(draw.id, input);
      toast.success(e.savedToast);
      onSaved(normalizeResults(saved));
      onOpenChange(false);
    } catch (err) {
      toast.error(e.saveFailedToast, { description: lotteryErrorMessage(err, t) });
    } finally {
      setSaving(false);
    }
  };

  /** The line under a group's boxes: the first problem found, the warning, or the count. */
  const groupLine = (key: LotteryPrizeGroupKey) => {
    const check = checks[key];
    const { count, digits } = LOTTERY_PRIZE_GROUP_SHAPE[key];
    const problem =
      check.wrongDigits ? e.wrongDigits(digits) : check.duplicate ? e.duplicate : !bahtOk[key] ? e.bahtInvalid : null;
    if (problem && (showProblems || check.numbers.length > 0)) {
      return <p className="text-xs text-destructive">{problem}</p>;
    }
    if (check.nearFirstOff && check.numbers.length === count) {
      return <p className="text-xs text-warning">{r.nearFirstWarning}</p>;
    }
    const short = check.numbers.length !== count;
    return (
      <p className={short && showProblems ? "text-xs tabular-nums text-destructive" : "text-xs tabular-nums text-muted-foreground"}>
        {e.countLine(check.numbers.length, count)}
      </p>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{e.title}</DialogTitle>
          <DialogDescription>{e.description(draw.drawNo, formatDateOnly(draw.thaiDrawDate))}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {LOTTERY_PRIZE_GROUP_KEYS.map((key) => {
            const { count, digits } = LOTTERY_PRIZE_GROUP_SHAPE[key];
            const check = checks[key];
            const invalid = showProblems && (!check.ok || !bahtOk[key]);
            const numbersId = `enter-${key}-numbers`;
            const bahtId = `enter-${key}-baht`;
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <Label htmlFor={numbersId}>{prizeGroupName(key, t)}</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{e.numbersLabel(count, digits)}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                  {count === 1 ? (
                    <Input
                      id={numbersId}
                      value={texts[key]}
                      inputMode="numeric"
                      maxLength={digits}
                      disabled={saving}
                      aria-invalid={invalid && !check.ok}
                      className="font-mono tabular-nums"
                      onChange={(ev) => setTexts((prev) => ({ ...prev, [key]: ev.target.value }))}
                    />
                  ) : (
                    <Textarea
                      id={numbersId}
                      value={texts[key]}
                      rows={count > 10 ? 4 : 2}
                      disabled={saving}
                      aria-invalid={invalid && !check.ok}
                      className="min-h-0 font-mono text-sm tabular-nums"
                      onChange={(ev) => setTexts((prev) => ({ ...prev, [key]: ev.target.value }))}
                    />
                  )}
                  <div className="flex flex-col gap-1">
                    <Input
                      id={bahtId}
                      type="number"
                      min={0}
                      step={1000}
                      value={bahts[key]}
                      disabled={saving}
                      aria-invalid={invalid && !bahtOk[key]}
                      aria-label={`${prizeGroupName(key, t)} — ${e.bahtLabel}`}
                      className="tabular-nums"
                      onChange={(ev) => setBahts((prev) => ({ ...prev, [key]: ev.target.value }))}
                    />
                    <span className="text-[11px] text-muted-foreground">{e.bahtLabel}</span>
                  </div>
                </div>
                {groupLine(key)}
              </div>
            );
          })}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="enter-note">{e.noteLabel}</Label>
            <Input
              id="enter-note"
              value={note}
              placeholder={e.notePlaceholder}
              maxLength={500}
              disabled={saving}
              onChange={(ev) => setNote(ev.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">{e.numbersHint} {e.replaceHint}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {e.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
