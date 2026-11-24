import Skeleton from "@/components/Skeleton";

function LoadingBlock({ className = "" }: { className?: string }) {
  return (
    <div className="relative" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className={className} />
    </div>
  );
}

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Hero */}
        <LoadingBlock className="h-4 w-44" />
        <LoadingBlock className="mt-3 h-10 w-2/3 max-w-3xl" />
        <LoadingBlock className="mt-4 h-4 w-full max-w-2xl" />
        <LoadingBlock className="mt-6 h-4 w-1/3 max-w-xl" />

        {/* Grid de stats */}
        <div className="mt-12 grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-paper px-5 py-5">
              <LoadingBlock className="h-8 w-16" />
              <LoadingBlock className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>

        {/* Cartões de plataforma */}
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-md border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <LoadingBlock className="h-10 w-10 rounded-full" />
                  <LoadingBlock className="h-4 w-24" />
                </div>
                <LoadingBlock className="h-4 w-16" />
              </div>
              <LoadingBlock className="mt-3 h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Mudanças recentes */}
        <div className="mt-12 grid gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
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
