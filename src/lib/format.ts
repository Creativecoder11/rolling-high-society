export const BDT = (n: number) =>
  `৳${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export type RoundingMode = "none" | "nearest_5" | "nearest_10";

export function applyRounding(value: number, mode: RoundingMode): number {
  if (!isFinite(value)) return 0;
  if (mode === "nearest_5") return Math.round(value / 5) * 5;
  if (mode === "nearest_10") return Math.round(value / 10) * 10;
  return Math.round(value * 100) / 100;
}

export function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
