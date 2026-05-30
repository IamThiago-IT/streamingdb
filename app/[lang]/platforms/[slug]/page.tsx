import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "../../dictionaries";
import { getPlatformBySlug } from "@/lib/queries";

export default async function PlatformDetail({
  params,
}: PageProps<"/[lang]"> & { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const platform = await getPlatformBySlug(slug);

  if (!platform) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link href={`/${lang}`} className="text-xl font-bold tracking-tight text-black dark:text-white">
            {dict.home.title}
          </Link>
          <nav className="flex gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <Link href={`/${lang}/platforms`}>{dict.nav.platforms}</Link>
            <Link href={`/${lang}/contents`}>{dict.nav.contents}</Link>
            <Link href={`/${lang}/changes`}>{dict.nav.changes}</Link>
          </nav>
        </div>
      </header>

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
              return (
                <div
                  key={plan.id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-black dark:text-white">{plan.name}</h3>
                      <p className="text-xs text-zinc-500">
                        {plan.ads ? "Com anúncios" : "Sem anúncios"}
                        {plan.quality ? ` · ${plan.quality}` : ""}
                        {plan.billingCycle !== "mensal" ? ` · ${plan.billingCycle}` : ""}
                      </p>
                    </div>
                    <p className="text-xl font-bold tabular-nums text-black dark:text-white">
                      R$ {latestPrice?.price.toFixed(2) ?? plan.price.toFixed(2)}
                      <span className="text-xs font-normal text-zinc-500">/{plan.billingCycle === "anual" ? "ano" : "mês"}</span>
                    </p>
                  </div>

                  {plan.priceHistory.length > 1 && (
                    <details className="mt-3">
                      <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
                        {dict.platform.priceHistory}
                      </summary>
                      <div className="mt-2 space-y-1">
                        {plan.priceHistory.map((h) => (
                          <div key={h.id} className="flex justify-between text-xs text-zinc-500">
                            <span>{new Date(h.recordedAt).toLocaleDateString("pt-BR")}</span>
                            <span className="font-medium">R$ {h.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </section>

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
