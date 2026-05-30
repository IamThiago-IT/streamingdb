import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "../../dictionaries";
import { getPlatformBySlug, getPlatformWithAllPriceHistory } from "@/lib/queries";
import PriceHistoryChart from "@/components/PriceHistoryChart";
import PriceBadge from "@/components/PriceBadge";
import Header from "@/components/Header";

export default async function PlatformDetail({
  params,
}: PageProps<"/[lang]"> & { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const platform = await getPlatformBySlug(slug);
  const platformWithHistory = await getPlatformWithAllPriceHistory(slug);

  if (!platform || !platformWithHistory) notFound();

  const chartData = platformWithHistory.plans.flatMap((plan) =>
    plan.priceHistory.map((h) => ({
      recordedAt: h.recordedAt.toISOString(),
      price: h.price,
      planName: plan.name,
    }))
  );

  const planColorMap: Record<string, string> = {};
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];
  platform.plans.forEach((plan, i) => {
    planColorMap[plan.name] = colors[i % colors.length];
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: platform.color ?? "#666" }}
          />
          <h1 className="text-2xl font-bold text-black dark:text-white">{platform.name}</h1>
        </div>

        <section className="mb-10">
          <h2 className="text-lg font-semibold text-black dark:text-white mb-4">{dict.platform.plans}</h2>
          <div className="grid gap-3">
            {platform.plans.map((plan) => {
              const latestPrice = plan.priceHistory[0];
              const previousPrice = plan.priceHistory[1];
              return (
                <div
                  key={plan.id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-black dark:text-white">{plan.name}</h3>
                        {previousPrice && (
                          <PriceBadge current={latestPrice!.price} previous={previousPrice.price} />
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">
                        {plan.ads ? "Com anúncios" : "Sem anúncios"}
                        {plan.quality ? ` · ${plan.quality}` : ""}
                        {plan.billingCycle !== "mensal" ? ` · ${plan.billingCycle}` : ""}
                      </p>
                    </div>
                    <p className="text-xl font-bold tabular-nums text-black dark:text-white">
                      R$ {latestPrice?.price.toFixed(2) ?? plan.price.toFixed(2)}
                      <span className="text-xs font-normal text-zinc-500">
                        /{plan.billingCycle === "anual" ? "ano" : "mês"}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {chartData.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-black dark:text-white mb-4">
              {dict.platform.priceHistory}
            </h2>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900">
              <PriceHistoryChart data={chartData} planColors={planColorMap} />
            </div>
          </section>
        )}

        <section className="mb-10">
          <h2 className="text-lg font-semibold text-black dark:text-white mb-4">
            {dict.platform.catalog} ({platform.availability.length} {dict.platform.contentCount})
          </h2>
          <div className="grid gap-2">
            {platform.availability.map((a) => (
              <Link
                key={a.id}
                href={`/${lang}/contents/${a.content.slug}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-black dark:text-white">{a.content.title}</p>
                  <p className="text-xs text-zinc-500">
                    {a.content.type === "MOVIE" ? dict.content.type_movie : dict.content.type_series}
                    {a.content.year ? ` · ${a.content.year}` : ""}
                  </p>
                </div>
                {a.content.rating && (
                  <span className="text-xs font-medium text-amber-500">★ {a.content.rating.toFixed(1)}</span>
                )}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-black dark:text-white mb-4">{dict.platform.changes}</h2>
          <div className="space-y-2">
            {platform.changeLog.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900 text-sm"
              >
                <span className="text-zinc-600 dark:text-zinc-400">{c.description}</span>
                <span className="ml-auto text-xs text-zinc-400">
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
