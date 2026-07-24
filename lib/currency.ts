/**
 * All monetary values across MyanFlix admin are denominated in Myanmar Kyat
 * (Ks). These helpers are the single place that formats them for display —
 * use them instead of hand-rolling `${...} Ks` strings so the format stays
 * consistent everywhere.
 */

export function formatKyat(amount: number, decimals = 0): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} Ks`;
}
