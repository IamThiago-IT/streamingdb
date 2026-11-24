import Skeleton from "@/components/Skeleton";

function LoadingBlock({ className = "" }: { className?: string }) {
  return (
    <div className="relative" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className={className} />
    </div>
  );
}

export default function ContentsLoading() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <LoadingBlock className="h-10 w-72" />

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-md border border-line bg-surface"
            >
              <LoadingBlock className="aspect-[2/3] w-full rounded-none" />
              <div className="space-y-2 p-4">
                <LoadingBlock className="h-4 w-3/4" />
                <LoadingBlock className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
