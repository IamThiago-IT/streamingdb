export default function PriceBadge({
  current,
  previous,
}: {
  current: number;
  previous?: number;
}) {
  if (previous === undefined || previous === current) return null;

  const diff = current - previous;
  const pct = ((diff / previous) * 100).toFixed(1);

  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-sm bg-rise-soft px-2 py-0.5 font-mono text-[11px] font-medium tnum text-rise">
        ↑ R$ {diff.toFixed(2)} ({pct}%)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 rounded-sm bg-fall-soft px-2 py-0.5 font-mono text-[11px] font-medium tnum text-fall">
      ↓ R$ {Math.abs(diff).toFixed(2)} ({Math.abs(Number(pct))}%)
    </span>
  );
}
