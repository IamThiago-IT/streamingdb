import Skeleton from "@/components/Skeleton";

function LoadingBlock({ className = "" }: { className?: string }) {
  return (
    <div className="relative" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className={className} />
    </div>
  );
}

export default function PlatformsLoading() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <LoadingBlock className="h-10 w-64" />
        <LoadingBlock className="mt-2 h-3 w-56" />

        <div className="mt-8 overflow-hidden rounded-md border border-line bg-surface">
          <div className="grid grid-cols-4 gap-4 border-b border-line bg-surface-2 px-4 py-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingBlock key={i} className="h-3 w-16" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-4 gap-4 border-t border-line px-4 py-3"
            >
              <LoadingBlock className="h-4 w-6" />
              <LoadingBlock className="h-4 w-40" />
              <LoadingBlock className="h-4 w-16" />
              <LoadingBlock className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
