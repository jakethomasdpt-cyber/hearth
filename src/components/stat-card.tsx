import { formatCents, pctChange } from "@/lib/format";

export function StatCard({
  label,
  valueCents,
  previousCents,
  invertColor = false,
  className = "",
}: {
  label: string;
  valueCents: number;
  /** Previous period value — renders a month-over-month delta chip. */
  previousCents?: number;
  /** For spending: an increase is bad (red), a decrease is good (green). */
  invertColor?: boolean;
  className?: string;
}) {
  const delta =
    previousCents !== undefined ? pctChange(valueCents, previousCents) : null;
  const isGood = delta !== null && (invertColor ? delta <= 0 : delta >= 0);

  return (
    <div className={`card card-hover p-5 ${className}`}>
      <p className="text-xs font-medium tracking-wide text-ink-muted">
        {label}
      </p>
      <p className="tnum mt-2 text-2xl font-semibold tracking-tight">
        {formatCents(valueCents)}
      </p>
      {delta !== null && (
        <p
          className={`tnum mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            isGood ? "bg-pos-dim text-pos" : "bg-neg-dim text-neg"
          }`}
        >
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs last month
        </p>
      )}
    </div>
  );
}
