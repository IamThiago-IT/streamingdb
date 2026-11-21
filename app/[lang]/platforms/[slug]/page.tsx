import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getDictionary, hasLocale } from "../../dictionaries";
import {
  getPlatformBySlug,
  getPlatformWithAllPriceHistory,
  getPlanPricesAtDates,
} from "@/lib/queries";
import PriceHistoryChart from "@/components/PriceHistoryChart";
import PriceBadge from "@/components/PriceBadge";
import Header from "@/components/Header";
import PlatformLogo from "@/components/PlatformLogo";
import PlatformBackdrop from "@/components/PlatformBackdrop";
import { getSelectedCountry } from "@/lib/country";
import { formatMoney, monthlyAmount } from "@/lib/money";
import { auth } from "@/lib/auth";
import {
  getCountryCurrency,
  getCountryName,
} from "@/lib/countries";

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const periods = [
  { key: "6m", label: "Há 6 meses" },
  { key: "1y", label: "Há 1 ano" },
  { key: "2y", label: "Há 2 anos" },
];

export default async function PlatformDetail({
  params,
}: PageProps<"/[lang]"> & { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const country = await getSelectedCountry();
  const countryName = getCountryName(country, lang);

  const platform = await getPlatformBySlug(slug, country);
  const platformWithHistory = await getPlatformWithAllPriceHistory(
    slug,
    country
  );

  if (!platform || !platformWithHistory) notFound();

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const isLoggedIn = !!session;

  const offers = platform.plans.flatMap((plan) => plan.offers);
  const bestOffer = [...offers]
    .sort(
      (a, b) =>
        monthlyAmount(a.amount, a.billingMonths) -
        monthlyAmount(b.amount, b.billingMonths)
    )[0];

  const planPrices = await getPlanPricesAtDates(platform.id, country);
  const priceByOffer = new Map(
    planPrices.map((price) => [price.offerId, price])
  );

  const chartData = platformWithHistory.plans.flatMap((plan) =>
    plan.offers.flatMap((offer) =>
      offer.history.map((history) => ({
        recordedAt: history.recordedAt.toISOString(),
        price: Number(history.amount),
        planName: offer.displayName ?? plan.name,
      }))
    )
  );

  const planColorMap: Record<string, string> = {};
  platform.plans.forEach((plan, i) => {
    const name = plan.offers[0]?.displayName ?? plan.name;
    planColorMap[name] = chartColors[i % chartColors.length];
  });

  const availabilityStatus = platform.platformCountries[0]?.status;

  return (
    <div className="relative isolate min-h-screen bg-paper">
      <PlatformBackdrop color={platform.color} />
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-2 flex items-center gap-3">
          <PlatformLogo
            name={platform.name}
            logo={platform.logo}
            color={platform.color}
            size="lg"
          />
          <h1 className="text-3xl text-ink">{platform.name}</h1>
        </div>
        <p className="mb-8 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          {dict.country.pricesFor} {countryName} · {getCountryCurrency(country)}
        </p>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl text-ink">{dict.platform.plans}</h2>
          <div className="grid gap-2">
            {platform.plans.map((plan) => {
              if (plan.offers.length === 0) {
                return (
                  <div
                    key={plan.id}
                    className="rounded-md border border-line bg-surface p-5"
                  >
                    <h3 className="font-medium text-ink">
                      {plan.name}
                    </h3>
                    <p className="mt-1 text-xs text-ink-faint">
                      {availabilityStatus === "NOT_AVAILABLE"
                        ? dict.country.notAvailable
                        : dict.country.notCollected}
                    </p>
                  </div>
                );
              }

              return plan.offers.map((offer) => {
                const latestPrice = offer.history[0]?.amount ?? offer.amount;
                const previousPrice = offer.history[1]?.amount;
                const prices = priceByOffer.get(offer.id);
                const cycleLabel =
                  offer.billingMonths === 12
                    ? dict.pricing.year
                    : dict.pricing.month;

                return (
                  <div
                    key={offer.id}
                    className="rounded-md border border-line bg-surface p-5"
                  >
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-ink">
                            {offer.displayName ?? plan.name}
                          </h3>
                          {bestOffer && offer.id === bestOffer.id && (
                            <span className="rounded-sm bg-fall-soft px-2 py-0.5 font-mono text-[11px] font-medium tnum text-fall">
                              {dict.platform.bestPrice}
                            </span>
                          )}
                          {previousPrice !== undefined && (
                            <PriceBadge
                              current={Number(latestPrice)}
                              previous={Number(previousPrice)}
                              currency={offer.currency}
                              locale={lang}
                            />
                          )}
                        </div>
                        <p className="mt-1 text-xs text-ink-faint">
                          {offer.ads ? "Com anúncios" : "Sem anúncios"}
                          {offer.quality ? ` · ${offer.quality}` : ""}
                          {offer.billingCycle !== "MONTHLY"
                            ? ` · ${cycleLabel}`
                            : ""}
                        </p>
                      </div>
                      <p className="flex-shrink-0 font-mono text-xl font-medium tnum text-ink">
                        {formatMoney(latestPrice, offer.currency, lang)}
                        <span className="text-xs font-normal text-ink-faint">
                          /{cycleLabel}
                        </span>
                      </p>
                    </div>

                    {prices && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {periods.map(({ key, label }) => {
                          const entry = prices.periodPrices[key];
                          if (!entry) return null;
                          const diff = Number(latestPrice) - entry.amount;
                          return (
                            <div key={key} className="rounded-sm bg-surface-2 px-3 py-1.5">
                              <span className="text-ink-faint">{label}:</span>
                              <span className="ml-1.5 font-mono font-medium tnum text-ink">
                                {formatMoney(entry.amount, offer.currency, lang)}
                              </span>
                              {diff !== 0 && (
                                <span className={`ml-1 font-mono tnum ${diff > 0 ? "text-rise" : "text-fall"}`}>
                                  {diff > 0 ? "↑" : "↓"} {formatMoney(Math.abs(diff), offer.currency, lang)}
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {prices.lowestPrice && (
                          <div className="rounded-sm bg-fall-soft px-3 py-1.5 text-fall">
                            <span className="font-medium">
                              Menor preço:{" "}
                              {formatMoney(
                                prices.lowestPrice.amount,
                                offer.currency,
                                lang
                              )}
                            </span>
                            <span className="ml-1 opacity-70">
                              ({new Date(prices.lowestPrice.date).toLocaleDateString(lang)})
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {(offer.status === "ACTIVE" || offer.status === "STALE") && (
                      <div className="mt-4 flex items-center justify-end border-t border-line pt-4">
                        <Link
                          href={
                            isLoggedIn
                              ? offer.sourceUrl ?? `/${lang}/platforms/${slug}`
                              : `/${lang}/login`
                          }
                          className="inline-flex items-center justify-center rounded bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
                        >
                          {isLoggedIn
                            ? dict.platform.subscribe
                            : dict.platform.signInToSubscribe}
                        </Link>
                      </div>
                    )}
                  </div>
                );
              });
            })}
          </div>
        </section>

        {chartData.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-2xl text-ink">
              {dict.platform.priceHistory}
            </h2>
            <div className="rounded-md border border-line bg-surface p-5">
              <PriceHistoryChart
                data={chartData}
                planColors={planColorMap}
                currency={getCountryCurrency(country)}
                locale={lang}
              />
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
                  {new Date(c.createdAt).toLocaleDateString(lang)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
