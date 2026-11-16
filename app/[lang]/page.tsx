import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "./dictionaries";
import { getDashboardStats, getRecentChanges, getPlatforms, getPriceComparison } from "@/lib/queries";
import Header from "@/components/Header";
import PlatformLogo from "@/components/PlatformLogo";

function ChangeMark({ type }: { type: string }) {
  const marks: Record<string, { glyph: string; className: string }> = {
    PRICE_CHANGE: { glyph: "R$", className: "bg-warn-soft text-warn" },
    CONTENT_ADDED: { glyph: "+", className: "bg-fall-soft text-fall" },
    CONTENT_REMOVED: { glyph: "−", className: "bg-rise-soft text-rise" },
    NEW_PLATFORM: { glyph: "N", className: "bg-accent-soft text-accent" },
  };
  const mark = marks[type] ?? { glyph: "·", className: "bg-surface-2 text-ink-faint" };
  const isPrice = type === "PRICE_CHANGE";

  return (
    <span
      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-sm font-mono font-semibold ${isPrice ? "text-[9px]" : "text-xs"} ${mark.className}`}
    >
      {mark.glyph}
    </span>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
      {children}
    </p>
  );
}

export default async function Home({
  params,
}: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const stats = await getDashboardStats();
  const changes = await getRecentChanges(undefined, 5);
  const platforms = await getPlatforms();
  const comparison = await getPriceComparison();

  const ledger = [
    { value: String(stats.platformCount), label: dict.home.stats.platforms, tone: "text-ink" },
    { value: String(stats.contentCount), label: dict.home.stats.contents, tone: "text-ink" },
    { value: String(stats.changeCount), label: dict.home.stats.changes, tone: "text-ink" },
  ];

  return (
    <div className="min-h-screen bg-paper">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-6xl px-4 py-12">
        <section className="mb-10">
          <Kicker>Preços · Catálogo · Mudanças</Kicker>
          <h1 className="mt-3 max-w-3xl text-4xl leading-[1.08] text-ink md:text-5xl">
            {dict.home.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
            {dict.home.description}
          </p>
        </section>

        <section className="mb-12">
          <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
            {ledger.map((item) => (
              <div key={item.label} className="bg-paper px-5 py-5">
                <p className={`whitespace-nowrap font-mono text-2xl font-medium tnum md:text-3xl ${item.tone}`}>
                  {item.value}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wider text-ink-faint">
                  {item.label}
                </p>
              </div>
            ))}
            {stats.cheapestPlan && (
              <div className="bg-paper px-5 py-5">
                <p className="whitespace-nowrap font-mono text-2xl font-medium tnum text-fall md:text-3xl">
                  R$ {stats.cheapestPlan.price.toFixed(2)}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wider text-ink-faint">
                  {dict.home.cheapest} · {stats.cheapestPlan.platform.name}
                </p>
              </div>
            )}
          </div>
        </section>

        {comparison.cheapest.length > 0 && (
          <section className="mb-12">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-2xl text-ink">Comparação de preços</h2>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                mensal
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-line bg-surface p-5">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Planos mais baratos
                </h3>
                <div className="space-y-1">
                  {comparison.cheapest.map((plan) => (
                    <Link
                      key={plan.id}
                      href={`/${lang}/platforms/${plan.platform.slug}`}
                      className="-mx-2 flex min-w-0 items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-surface-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <PlatformLogo platform={plan.platform} size="sm" />
                        <span className="truncate text-ink">{plan.platform.name}</span>
                        <span className="hidden truncate text-ink-faint sm:inline">· {plan.name}</span>
                      </div>
                      <span className="ml-2 flex-shrink-0 font-mono text-[13px] tnum text-ink">
                        R$ {plan.price.toFixed(2)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-line bg-surface p-5">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Sem anúncios (mais baratos)
                </h3>
                <div className="space-y-1">
                  {comparison.cheapestNoAds.map((plan) => (
                    <Link
                      key={plan.id}
                      href={`/${lang}/platforms/${plan.platform.slug}`}
                      className="-mx-2 flex min-w-0 items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-surface-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <PlatformLogo platform={plan.platform} size="sm" />
                        <span className="truncate text-ink">{plan.platform.name}</span>
                        <span className="hidden truncate text-ink-faint sm:inline">· {plan.name}</span>
                      </div>
                      <span className="ml-2 flex-shrink-0 font-mono text-[13px] tnum text-ink">
                        R$ {plan.price.toFixed(2)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mb-12">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl text-ink">{dict.nav.platforms}</h2>
            <Link
              href={`/${lang}/platforms`}
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Ver todas →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {platforms.map((p) => {
              const minPrice = p.plans.length > 0 ? Math.min(...p.plans.map((pl) => pl.price)) : null;
              return (
                <Link
                  key={p.id}
                  href={`/${lang}/platforms/${p.slug}`}
                  className="min-w-0 rounded-md border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <PlatformLogo platform={p} size="md" />
                      <span className="min-w-0 text-[13px] font-medium leading-tight text-ink sm:text-sm">
                        {p.name}
                      </span>
                    </div>
                    {minPrice !== null && (
                      <span className="hidden flex-shrink-0 font-mono text-[11px] tnum text-ink-faint sm:inline">
                        R$ {minPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-ink-faint">
                    {p.plans.length}{" "}
                    {p.plans.length === 1 ? dict.platforms.planSingular : dict.platforms.plans} ·{" "}
                    {p._count.availability}{" "}
                    {p._count.availability === 1
                      ? dict.platforms.contentSingular
                      : dict.platforms.contentCount}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl text-ink">{dict.nav.changes}</h2>
            <Link
              href={`/${lang}/changes`}
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Ver todas →
            </Link>
          </div>
          <div className="grid gap-2">
            {changes.map((c) => (
              <div
                key={c.id}
                className="flex min-w-0 items-start gap-3 rounded-md border border-line bg-surface px-4 py-3 text-sm"
              >
                <span className="mt-0.5 flex-shrink-0">
                  <ChangeMark type={c.type} />
                </span>
                <span className="min-w-0 flex-1 text-sm leading-snug text-ink-muted">
                  {c.description}
                </span>
                <span className="mt-0.5 flex-shrink-0 font-mono text-[11px] tnum text-ink-faint">
                  {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
