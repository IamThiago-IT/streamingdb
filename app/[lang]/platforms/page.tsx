import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, Locale } from "@/lib/dictionaries";
import { getPlatforms } from "@/lib/queries";
import Header from "@/components/Header";
import PlatformLogo from "@/components/PlatformLogo";
import { getSelectedCountry } from "@/lib/country";
import { formatMoney, monthlyAmount } from "@/lib/money";
import { getCountryName } from "@/lib/countries";

export default async function PlatformsPage({
  params,
}: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang as Locale);
  const country = await getSelectedCountry();
  const countryName = getCountryName(country, lang);
  const platforms = await getPlatforms(country);

  const rows = platforms.map((platform) => {
    const offers = platform.plans.flatMap((plan) => plan.offers);
    const minOffer = [...offers].sort(
      (a, b) =>
        monthlyAmount(a.amount, a.billingMonths) -
        monthlyAmount(b.amount, b.billingMonths)
    )[0];

    return {
      platform,
      planCount: platform.plans.filter((plan) => plan.offers.length > 0).length,
      minOffer,
    };
  });

  const sorted = rows.sort((a, b) => {
    const aPrice = a.minOffer
      ? monthlyAmount(a.minOffer.amount, a.minOffer.billingMonths)
      : Number.POSITIVE_INFINITY;
    const bPrice = b.minOffer
      ? monthlyAmount(b.minOffer.amount, b.minOffer.billingMonths)
      : Number.POSITIVE_INFINITY;
    return aPrice - bPrice;
  });

  return (
    <div className="min-h-screen bg-paper">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="mb-1 text-3xl text-ink">{dict.platforms.title}</h1>
        <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          {dict.country.pricesFor} {countryName}
        </p>

        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-ink-faint">
                <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.12em]">#</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.12em]">{dict.platforms.title}</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.12em]">{dict.platforms.plans}</th>
                <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em]">{dict.platforms.price}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map(({ platform, planCount, minOffer }, i) => {
                const availability = platform.platformCountries[0]?.status;
                const isUnavailable = availability === "NOT_AVAILABLE";

                return (
                  <tr
                    key={platform.id}
                    className="transition-colors hover:bg-surface-2"
                  >
                    <td className="px-4 py-3 font-mono text-xs tnum text-ink-faint">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${lang}/platforms/${platform.slug}`}
                        className="flex items-center gap-3 font-medium text-ink"
                      >
                        <PlatformLogo
                          name={platform.name}
                          logo={platform.logo}
                          color={platform.color}
                          size="md"
                        />
                        {platform.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tnum text-ink-muted">
                      {isUnavailable ? (
                        <span className="font-sans text-ink-faint">{dict.country.notAvailable}</span>
                      ) : planCount > 0 ? (
                        planCount
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] tnum text-ink">
                      {minOffer ? (
                        <>
                          {formatMoney(
                            monthlyAmount(minOffer.amount, minOffer.billingMonths),
                            minOffer.currency,
                            lang
                          )}
                          <span className="text-[10px] font-normal text-ink-faint">
                            /{dict.pricing.month}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
