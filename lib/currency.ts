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

/**
 * Deposit/Withdrawal amounts are always positive from the backend — direction
 * isn't encoded in the sign. This prefixes a +/- based on which page/column
 * is rendering it (a known constant, e.g. Deposits is always inbound), so
 * "money in" vs "money out" is legible at a glance without touching the
 * underlying value.
 */
export function formatSignedKyat(amount: number, direction: "in" | "out", decimals = 0): string {
  const prefix = direction === "in" ? "+" : "-";
  return `${prefix}${formatKyat(Math.abs(amount), decimals)}`;
}
