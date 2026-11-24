import Skeleton from "@/components/Skeleton";

function LoadingBlock({ className = "" }: { className?: string }) {
  return (
    <div className="relative" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className={className} />
    </div>
  );
}

export default function CompareLoading() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <LoadingBlock className="h-10 w-72" />

        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-md border border-line bg-surface p-5"
            >
              <LoadingBlock className="h-4 w-32" />
              <div className="mt-4 space-y-2">
                <LoadingBlock className="h-4 w-full" />
                <LoadingBlock className="h-4 w-5/6" />
                <LoadingBlock className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
