"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { lotteryErrorMessage, parseOffSaleInput, sameNumbers } from "@/components/lottery/drawFormat";
import { useLanguage } from "@/lib/context/language-context";
import { lotteryService } from "@/services/api/lotteryService";
import { LOTTERY_LIMITS, type LotteryAdminDraw } from "@/types/lottery";

interface OffSaleNumbersCardProps {
  drawId: string;
  /** The list the server holds. The parent remounts the card (via `key`) when it changes. */
  numbers: string[];
  canManage: boolean;
  onSaved: (draw: LotteryAdminDraw) => void;
}

/**
 * The numbers customers cannot buy in this draw, as chips. Add takes one
 * six-digit number or several pasted at once; Save replaces the whole list
 * on the server (PUT), so the chips are the list. Nothing is sent until
 * Save.
 */
export function OffSaleNumbersCard({ drawId, numbers, canManage, onSaved }: OffSaleNumbersCardProps) {
  const { t } = useLanguage();
  const o = t.lottery.draws.detail.offSale;
  const [list, setList] = useState(numbers);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = !sameNumbers(list, numbers);
  const max = LOTTERY_LIMITS.offSaleNumbers;

  const add = () => {
    const { numbers: parsed, invalid } = parseOffSaleInput(text);
    if (invalid.length > 0 || parsed.length === 0) {
      setProblem(o.invalid);
      return;
    }
    const fresh = Array.from(new Set(parsed)).filter((n) => !list.includes(n));
    if (fresh.length === 0) {
      setProblem(o.duplicate);
      return;
    }
    if (list.length + fresh.length > max) {
      setProblem(o.tooMany(max));
      return;
    }
    setList([...list, ...fresh]);
    setText("");
    setProblem(null);
  };

  const remove = (number: string) => setList((prev) => prev.filter((n) => n !== number));

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await lotteryService.setOffSaleNumbers(drawId, list);
      toast.success(o.savedToast);
      onSaved(saved);
    } catch (err) {
      toast.error(o.saveFailedToast, { description: lotteryErrorMessage(err, t) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {o.title}
          <span className="text-xs font-normal tabular-nums text-muted-foreground">{o.count(list.length)}</span>
        </CardTitle>
        <CardDescription>{o.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{o.empty}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {list.map((number) => (
              <span
                key={number}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--border-strong)] bg-secondary/40 pl-2.5 pr-1 font-mono text-xs tabular-nums"
              >
                {number}
                {canManage ? (
                  <button
                    type="button"
                    className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                    aria-label={o.remove(number)}
                    disabled={saving}
                    onClick={() => remove(number)}
                  >
                    <X className="size-3" />
                  </button>
                ) : (
                  <span className="w-1.5" />
                )}
              </span>
            ))}
          </div>
        )}

        {canManage && (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <Input
                  value={text}
                  placeholder={o.addPlaceholder}
                  inputMode="numeric"
                  disabled={saving}
                  aria-invalid={!!problem}
                  aria-label={o.addPlaceholder}
                  className="font-mono tabular-nums sm:max-w-xs"
                  onChange={(e) => {
                    setText(e.target.value);
                    if (problem) setProblem(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      add();
                    }
                  }}
                />
                <Button type="button" variant="outline" disabled={saving || text.trim() === ""} onClick={add}>
                  <Plus className="size-4" />
                  {o.add}
                </Button>
              </div>
              <p className={problem ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {problem ?? o.addHint}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{dirty ? o.unsaved : ""}</p>
              <Button onClick={handleSave} disabled={saving || !dirty}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {o.save}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
