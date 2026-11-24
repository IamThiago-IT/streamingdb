import Skeleton from "@/components/Skeleton";

function LoadingBlock({ className = "" }: { className?: string }) {
  return (
    <div className="relative" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className={className} />
    </div>
  );
}

export default function ChangesLoading() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <LoadingBlock className="h-10 w-72" />

        <div className="grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-md border border-line bg-surface px-4 py-3"
            >
              <LoadingBlock className="h-6 w-6 rounded-sm" />
              <LoadingBlock className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
