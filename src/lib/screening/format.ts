import type { MetricUnit } from "./taxonomy";

// Render a stored metric value for display, given its unit.
export function formatMetric(
  value: number | string | null | undefined,
  unit: MetricUnit,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (unit === "text" || unit === "year") return String(value);

  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);

  switch (unit) {
    case "usd":
    case "usd_per_unit":
      return "$" + Math.round(n).toLocaleString();
    case "pct":
      return n.toFixed(1) + "%";
    case "ratio":
      return n.toFixed(2) + "x";
    case "count":
      return n.toLocaleString();
    default:
      return String(value);
  }
}
