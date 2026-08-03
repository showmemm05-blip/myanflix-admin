export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex++;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return bytesPerSecond > 0 ? `${formatBytes(bytesPerSecond)}/s` : "—";
}

export function formatEta(seconds: number | null): string {
  if (seconds === null) return "Estimating...";
  if (seconds < 60) return `${Math.round(seconds)}s remaining`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s remaining`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m remaining`;
}
