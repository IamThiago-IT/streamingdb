import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "../../dictionaries";
import { getPlatformBySlug, getPlatformWithAllPriceHistory, getPlanPricesAtDates } from "@/lib/queries";
import PriceHistoryChart from "@/components/PriceHistoryChart";
import PriceBadge from "@/components/PriceBadge";
import Header from "@/components/Header";
import PlatformLogo from "@/components/PlatformLogo";

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export default async function PlatformDetail({
  params,
}: PageProps<"/[lang]"> & { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const platform = await getPlatformBySlug(slug);
  const platformWithHistory = await getPlatformWithAllPriceHistory(slug);

  if (!platform || !platformWithHistory) notFound();

  const planPrices = await getPlanPricesAtDates(platform.id);

  const periods = [
    { key: "6m", label: "Há 6 meses" },
    { key: "1y", label: "Há 1 ano" },
    { key: "2y", label: "Há 2 anos" },
  ];

  const chartData = platformWithHistory.plans.flatMap((plan) =>
    plan.priceHistory.map((h) => ({
      recordedAt: h.recordedAt.toISOString(),
      price: h.price,
      planName: plan.name,
    }))
  );

  const planColorMap: Record<string, string> = {};
  platform.plans.forEach((plan, i) => {
    planColorMap[plan.name] = chartColors[i % chartColors.length];
  });

  return (
    <div className="min-h-screen bg-paper">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 flex items-center gap-3">
          <PlatformLogo platform={platform} size="lg" />
          <h1 className="text-3xl text-ink">{platform.name}</h1>
        </div>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl text-ink">{dict.platform.plans}</h2>
          <div className="grid gap-2">
            {platform.plans.map((plan) => {
              const latestPrice = plan.priceHistory[0];
              const previousPrice = plan.priceHistory[1];
              const prices = planPrices.find((p) => p.planId === plan.id);

              return (
                <div
                  key={plan.id}
                  className="rounded-md border border-line bg-surface p-5"
                >
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-ink">{plan.name}</h3>
                        {previousPrice && (
                          <PriceBadge current={latestPrice!.price} previous={previousPrice.price} />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink-faint">
                        {plan.ads ? "Com anúncios" : "Sem anúncios"}
                        {plan.quality ? ` · ${plan.quality}` : ""}
                        {plan.billingCycle !== "mensal" ? ` · ${plan.billingCycle}` : ""}
                      </p>
                    </div>
                    <p className="flex-shrink-0 font-mono text-xl font-medium tnum text-ink">
                      R$ {latestPrice?.price.toFixed(2) ?? plan.price.toFixed(2)}
                      <span className="text-xs font-normal text-ink-faint">
                        /{plan.billingCycle === "anual" ? "ano" : "mês"}
                      </span>
                    </p>
                  </div>

                  {prices && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {periods.map(({ key, label }) => {
                        const entry = prices.periodPrices[key];
                        if (!entry) return null;
                        const diff = (latestPrice?.price ?? plan.price) - entry.price;
                        return (
                          <div key={key} className="rounded-sm bg-surface-2 px-3 py-1.5">
                            <span className="text-ink-faint">{label}:</span>
                            <span className="ml-1.5 font-mono font-medium tnum text-ink">
                              R$ {entry.price.toFixed(2)}
                            </span>
                            {diff !== 0 && (
                              <span className={`ml-1 font-mono tnum ${diff > 0 ? "text-rise" : "text-fall"}`}>
                                {diff > 0 ? "↑" : "↓"} {Math.abs(diff).toFixed(2)}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {prices.lowestPrice && (
                        <div className="rounded-sm bg-fall-soft px-3 py-1.5 text-fall">
                          <span className="font-medium">Menor preço: R$ {prices.lowestPrice.price.toFixed(2)}</span>
                          <span className="ml-1 opacity-70">
                            ({new Date(prices.lowestPrice.date).toLocaleDateString("pt-BR")})
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {chartData.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-2xl text-ink">
              {dict.platform.priceHistory}
            </h2>
            <div className="rounded-md border border-line bg-surface p-5">
              <PriceHistoryChart data={chartData} planColors={planColorMap} />
            </div>
          </section>
        )}

        <section className="mb-10">
          <h2 className="mb-4 text-2xl text-ink">
            {dict.platform.catalog} ({platform.availability.length} {dict.platform.contentCount})
          </h2>
          <div className="grid gap-2">
            {platform.availability.map((a) => (
              <Link
                key={a.id}
                href={`/${lang}/contents/${a.content.slug}`}
                className="flex min-w-0 items-center justify-between rounded-md border border-line bg-surface p-3 transition-colors hover:border-line-strong"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{a.content.title}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {a.content.type === "MOVIE" ? dict.content.type_movie : dict.content.type_series}
                    {a.content.year ? ` · ${a.content.year}` : ""}
                  </p>
                </div>
                {a.content.rating && (
                  <span className="font-mono text-xs text-warn">★ {a.content.rating.toFixed(1)}</span>
                )}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl text-ink">{dict.platform.changes}</h2>
          <div className="grid gap-2">
            {platform.changeLog.map((c) => (
              <div
                key={c.id}
                className="flex min-w-0 items-start gap-3 rounded-md border border-line bg-surface px-4 py-3 text-sm"
              >
                <span className="min-w-0 flex-1 leading-snug text-ink-muted">{c.description}</span>
                <span className="mt-0.5 flex-shrink-0 font-mono text-xs tnum text-ink-faint">
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
