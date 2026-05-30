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
      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
        ↑ R$ {diff.toFixed(2)} ({pct}%)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      ↓ R$ {Math.abs(diff).toFixed(2)} ({Math.abs(Number(pct))}%)
    </span>
  );
}
