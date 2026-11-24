import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, Locale } from "@/lib/dictionaries";
import { getPlatforms } from "@/lib/queries";
import Header from "@/components/Header";
import PlatformLogo from "@/components/PlatformLogo";
import ComparePicker from "@/components/compare/ComparePicker";
import { getSelectedCountry } from "@/lib/country";
import { formatMoney, monthlyAmount } from "@/lib/money";
import { getCountryCurrency, getCountryName } from "@/lib/countries";

const MAX_PLATFORMS = 3;

type PlatformRow = Awaited<ReturnType<typeof getPlatforms>>[number];
type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
type OfferRow = PlatformRow["plans"][number]["offers"][number];

type OfferSummary = {
  offer: OfferRow;
  label: string;
  monthly: number;
};

const qualityScores: { pattern: RegExp; score: number }[] = [
  { pattern: /8k/i, score: 6 },
  { pattern: /4k|uhd/i, score: 5 },
  { pattern: /full\s*hd|fhd|1080/i, score: 4 },
  { pattern: /\bhd\b|720/i, score: 3 },
  { pattern: /\bsd\b|480/i, score: 2 },
];

function qualityScore(quality: string): number {
  return qualityScores.find(({ pattern }) => pattern.test(quality))?.score ?? 1;
}

function bestQuality(qualities: string[]): string | null {
  return (
    qualities.sort((a, b) => qualityScore(b) - qualityScore(a))[0] ?? null
  );
}

function cycleLabel(months: number, dict: Dictionary): string {
  if (months <= 1) return dict.pricing.month;
  if (months === 12) return dict.pricing.year;
  return `${months} ${dict.pricing.months}`;
}

/** Aceita `?platforms=a,b` e também `?platforms=a&platforms=b`. */
function parseSlugs(value: string | string[] | undefined): string[] {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return [
    ...new Set(
      entries
        .flatMap((entry) => entry.split(","))
        .map((entry) => entry.trim())
        .filter(Boolean)
    ),
  ];
}

function removeHref(lang: string, slugs: string[], slug: string): string {
  const remaining = slugs.filter((item) => item !== slug);
  return remaining.length > 0
    ? `/${lang}/compare?platforms=${remaining.map(encodeURIComponent).join(",")}`
    : `/${lang}/compare`;
}

function matchesBest(monthly: number, best: number | null): boolean {
  return best !== null && Math.abs(monthly - best) < 0.005;
}

function summarize(platform: PlatformRow) {
  const offers: OfferSummary[] = platform.plans
    .flatMap((plan) =>
      plan.offers.map((offer) => ({
        offer,
        label: offer.displayName ?? plan.name,
        monthly: monthlyAmount(offer.amount, offer.billingMonths),
      }))
    )
    .sort((a, b) => a.monthly - b.monthly);

  const qualities = offers
    .map((entry) => entry.offer.quality)
    .filter((quality): quality is string => Boolean(quality));

  return {
    platform,
    offers,
    unavailable: platform.platformCountries[0]?.status === "NOT_AVAILABLE",
    cheapest: offers[0] ?? null,
    cheapestNoAds: offers.find((entry) => !entry.offer.ads) ?? null,
    cheapestAds: offers.find((entry) => entry.offer.ads) ?? null,
    planCount: platform.plans.filter((plan) => plan.offers.length > 0).length,
    catalogCount: platform._count.availability,
    maxQuality: bestQuality(qualities),
  };
}

function PriceCell({
  entry,
  lang,
  dict,
  isBest,
}: {
  entry: OfferSummary;
  lang: string;
  dict: Dictionary;
  isBest: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[13px] tnum text-ink">
          {formatMoney(entry.monthly, entry.offer.currency, lang)}
          <span className="text-[10px] font-normal text-ink-faint">
            /{dict.pricing.month}
          </span>
        </span>
        {isBest && (
          <span className="rounded-sm bg-fall px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-on-accent">
            {dict.compare.bestPrice}
          </span>
        )}
      </div>
      <p className="mt-0.5 truncate text-xs text-ink-faint" title={entry.label}>
        {entry.label}
      </p>
      {entry.offer.billingMonths > 1 && (
        <p className="mt-0.5 font-mono text-[10px] tnum text-ink-faint">
          {formatMoney(entry.offer.amount, entry.offer.currency, lang)}/
          {cycleLabel(entry.offer.billingMonths, dict)}
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr className="even:bg-surface-2">
      <th
        scope="row"
        className="px-4 py-3 text-left align-top text-sm font-normal text-ink-muted"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};

  const dict = await getDictionary(lang as Locale);
  return { title: dict.compare.title };
}

export default async function ComparePage({
  params,
  searchParams,
}: PageProps<"/[lang]">) {
  const { lang } = await params;
  const sp = await searchParams;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang as Locale);
  const country = await getSelectedCountry();
  const countryName = getCountryName(country, lang);
  const countryCurrency = getCountryCurrency(country);
  const platforms = await getPlatforms(country);

  const selected = parseSlugs(sp.platforms)
    .map((slug) => platforms.find((platform) => platform.slug === slug))
    .filter((platform): platform is PlatformRow => Boolean(platform))
    .slice(0, MAX_PLATFORMS);

  const selectedSlugs = selected.map((platform) => platform.slug);
  const summaries = selected.map(summarize);

  const priced = summaries.filter(
    (summary) => !summary.unavailable && summary.cheapest
  );
  const bestMonthly =
    priced.length > 1
      ? Math.min(
          ...priced.map(
            (summary) =>
              summary.cheapest?.monthly ?? Number.POSITIVE_INFINITY
          )
        )
      : null;

  const adFree = summaries.filter(
    (summary) => !summary.unavailable && summary.cheapestNoAds
  );
  const bestNoAdsMonthly =
    adFree.length > 1
      ? Math.min(
          ...adFree.map(
            (summary) =>
              summary.cheapestNoAds?.monthly ?? Number.POSITIVE_INFINITY
          )
        )
      : null;

  return (
    <div className="min-h-screen bg-paper">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="mb-1 text-3xl text-ink">{dict.compare.title}</h1>
        <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          {dict.country.pricesFor} {countryName} · {countryCurrency}
        </p>

        <ComparePicker
          key={selectedSlugs.join(",") || "none"}
          lang={lang}
          platforms={platforms.map(
            ({ slug, name, logo, color, platformCountries }) => ({
              slug,
              name,
              logo,
              color,
              unavailable:
                platformCountries[0]?.status === "NOT_AVAILABLE",
            })
          )}
          initialSelected={selectedSlugs}
          labels={{
            pick: dict.compare.pick,
            selectedCount: dict.compare.selectedCount,
            compare: dict.compare.compare,
            loading: dict.compare.loading,
            clear: dict.compare.clear,
            hint: dict.compare.hint,
            max: dict.compare.max,
            unavailable: dict.compare.unavailable,
          }}
        />

        {selected.length < 2 && (
          <div className="rounded-md border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
            <p className="text-lg text-ink-muted">
              {selected.length === 0
                ? dict.compare.emptyTitle
                : dict.compare.oneSelected}
            </p>
            {selected.length === 0 && (
              <p className="mt-1 text-sm text-ink-faint">
                {dict.compare.emptyHint}
              </p>
            )}
          </div>
        )}

        {selected.length >= 2 && (
          <>
            <div className="overflow-x-auto rounded-md border border-line bg-surface">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <th
                      scope="col"
                      className="w-44 px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint"
                    >
                      {dict.compare.feature}
                    </th>
                    {summaries.map(({ platform }) => (
                      <th
                        key={platform.id}
                        scope="col"
                        className="min-w-[150px] px-4 py-3 text-left align-top"
                      >
                        <div className="flex items-start gap-2">
                          <Link
                            href={`/${lang}/platforms/${platform.slug}`}
                            className="flex min-w-0 items-center gap-2 font-medium text-ink transition-colors hover:text-accent"
                          >
                            <PlatformLogo
                              name={platform.name}
                              logo={platform.logo}
                              color={platform.color}
                              size="sm"
                            />
                            <span className="truncate">{platform.name}</span>
                          </Link>
                          <Link
                            href={removeHref(lang, selectedSlugs, platform.slug)}
                            aria-label={`${dict.compare.remove} ${platform.name}`}
                            title={dict.compare.remove}
                            className="ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-sm text-base leading-none text-ink-faint transition-colors hover:bg-rise-soft hover:text-rise"
                          >
                            ×
                          </Link>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <Row label={dict.compare.cheapest}>
                    {summaries.map((summary) => {
                      const isBest = summary.cheapest
                        ? matchesBest(summary.cheapest.monthly, bestMonthly)
                        : false;

                      return (
                        <td
                          key={summary.platform.id}
                          className={`px-4 py-3 align-top ${
                            isBest ? "bg-fall-soft" : ""
                          }`}
                        >
                          {summary.unavailable ? (
                            <span className="text-xs text-ink-faint">
                              {dict.country.notAvailable}
                            </span>
                          ) : summary.cheapest ? (
                            <PriceCell
                              entry={summary.cheapest}
                              lang={lang}
                              dict={dict}
                              isBest={isBest}
                            />
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                      );
                    })}
                  </Row>

                  <Row label={dict.compare.cheapestNoAds}>
                    {summaries.map((summary) => {
                      const isBest = summary.cheapestNoAds
                        ? matchesBest(
                            summary.cheapestNoAds.monthly,
                            bestNoAdsMonthly
                          )
                        : false;

                      return (
                        <td
                          key={summary.platform.id}
                          className={`px-4 py-3 align-top ${
                            isBest ? "bg-fall-soft" : ""
                          }`}
                        >
                          {summary.unavailable ? (
                            <span className="text-ink-faint">—</span>
                          ) : summary.cheapestNoAds ? (
                            <PriceCell
                              entry={summary.cheapestNoAds}
                              lang={lang}
                              dict={dict}
                              isBest={isBest}
                            />
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                      );
                    })}
                  </Row>

                  <Row label={dict.compare.planCount}>
                    {summaries.map((summary) => (
                      <td
                        key={summary.platform.id}
                        className="px-4 py-3 font-mono text-[13px] tnum text-ink"
                      >
                        {summary.planCount > 0 ? (
                          summary.planCount
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    ))}
                  </Row>

                  <Row label={dict.compare.catalog}>
                    {summaries.map((summary) => (
                      <td
                        key={summary.platform.id}
                        className="px-4 py-3 font-mono text-[13px] tnum text-ink"
                      >
                        {summary.catalogCount > 0 ? (
                          summary.catalogCount
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    ))}
                  </Row>

                  <Row label={dict.compare.maxQuality}>
                    {summaries.map((summary) => (
                      <td
                        key={summary.platform.id}
                        className="px-4 py-3 text-sm text-ink"
                      >
                        {summary.maxQuality ?? (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    ))}
                  </Row>

                  <Row label={dict.compare.adsOption}>
                    {summaries.map((summary) => (
                      <td
                        key={summary.platform.id}
                        className="px-4 py-3 align-top"
                      >
                        {summary.cheapestAds ? (
                          <div>
                            <span className="text-sm text-warn">
                              {dict.compare.yes}
                            </span>
                            <p className="mt-0.5 font-mono text-[11px] tnum text-ink-muted">
                              {formatMoney(
                                summary.cheapestAds.monthly,
                                summary.cheapestAds.offer.currency,
                                lang
                              )}
                              <span className="text-[10px] text-ink-faint">
                                /{dict.pricing.month}
                              </span>
                            </p>
                          </div>
                        ) : summary.offers.length > 0 ? (
                          <span className="text-sm text-fall">
                            {dict.compare.no}
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    ))}
                  </Row>

                  <Row label={dict.compare.availability}>
                    {summaries.map((summary) => (
                      <td
                        key={summary.platform.id}
                        className="px-4 py-3 text-sm"
                      >
                        {summary.unavailable ? (
                          <span className="text-rise">
                            {dict.compare.notAvailable}
                          </span>
                        ) : summary.offers.length > 0 ? (
                          <span className="text-fall">
                            {dict.compare.available}
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    ))}
                  </Row>
                </tbody>
              </table>
            </div>

            <section className="mt-10">
              <h2 className="mb-4 text-2xl text-ink">
                {dict.compare.plansTitle}
              </h2>
              <div
                className={`grid gap-4 md:grid-cols-2 ${
                  selected.length === 3 ? "lg:grid-cols-3" : ""
                }`}
              >
                {summaries.map((summary) => (
                  <article
                    key={summary.platform.id}
                    className="flex min-w-0 flex-col rounded-md border border-line bg-surface"
                  >
                    <div className="flex min-w-0 items-center gap-2 border-b border-line px-4 py-3">
                      <PlatformLogo
                        name={summary.platform.name}
                        logo={summary.platform.logo}
                        color={summary.platform.color}
                        size="sm"
                      />
                      <Link
                        href={`/${lang}/platforms/${summary.platform.slug}`}
                        className="min-w-0 truncate text-sm font-medium text-ink transition-colors hover:text-accent"
                      >
                        {summary.platform.name}
                      </Link>
                    </div>

                    <div className="flex-1 divide-y divide-line">
                      {summary.offers.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs text-ink-faint">
                          {summary.unavailable
                            ? dict.country.notAvailable
                            : dict.country.notCollected}
                        </p>
                      ) : (
                        summary.offers.map((entry, index) => (
                          <div key={entry.offer.id} className="px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                  <p className="truncate text-sm text-ink">
                                    {entry.label}
                                  </p>
                                  {index === 0 && !summary.unavailable && (
                                    <span className="flex-shrink-0 rounded-sm bg-fall-soft px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-fall">
                                      {dict.compare.bestPrice}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-[11px] text-ink-faint">
                                  {entry.offer.ads
                                    ? dict.compare.withAds
                                    : dict.compare.withoutAds}
                                  {entry.offer.quality
                                    ? ` · ${entry.offer.quality}`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <p className="font-mono text-[13px] tnum text-ink">
                                  {formatMoney(
                                    entry.offer.amount,
                                    entry.offer.currency,
                                    lang
                                  )}
                                </p>
                                <p className="text-[10px] text-ink-faint">
                                  /
                                  {cycleLabel(
                                    entry.offer.billingMonths,
                                    dict
                                  )}
                                </p>
                              </div>
                            </div>
                            {entry.offer.billingMonths > 1 && (
                              <p className="mt-1 font-mono text-[10px] tnum text-ink-faint">
                                {formatMoney(
                                  entry.monthly,
                                  entry.offer.currency,
                                  lang
                                )}
                                /{dict.pricing.month} ·{" "}
                                {dict.compare.monthlyEquivalent}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="border-t border-line px-4 py-2.5">
                      <Link
                        href={`/${lang}/platforms/${summary.platform.slug}`}
                        className="text-xs font-medium text-accent transition-colors hover:text-accent-hover"
                      >
                        {dict.compare.viewPlatform} →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
