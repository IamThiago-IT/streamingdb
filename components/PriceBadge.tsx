import { formatMoney } from "@/lib/money";

export default function PriceBadge({
  current,
  previous,
  currency,
  locale,
}: {
  current: number;
  previous?: number;
  currency: string;
  locale: string;
}) {
  if (previous === undefined || previous === current) return null;

  const diff = current - previous;
  const pct = ((diff / previous) * 100).toFixed(1);
  const amount = formatMoney(Math.abs(diff), currency, locale);

  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-sm bg-rise-soft px-2 py-0.5 font-mono text-[11px] font-medium tnum text-rise">
        ↑ {amount} ({pct}%)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 rounded-sm bg-fall-soft px-2 py-0.5 font-mono text-[11px] font-medium tnum text-fall">
      ↓ {amount} ({Math.abs(Number(pct))}%)
    </span>
  );
}
