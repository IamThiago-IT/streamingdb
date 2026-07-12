import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "./dictionaries";
import { getDashboardStats, getRecentChanges, getPlatforms, getPriceComparison } from "@/lib/queries";
import Header from "@/components/Header";
import PlatformLogo from "@/components/PlatformLogo";

function ChangeIcon({ type }: { type: string }) {
  switch (type) {
    case "PRICE_CHANGE": return <span className="text-amber-500">💰</span>;
    case "CONTENT_ADDED": return <span className="text-emerald-500">➕</span>;
    case "CONTENT_REMOVED": return <span className="text-red-500">➖</span>;
    case "NEW_PLATFORM": return <span className="text-blue-500">🆕</span>;
    default: return <span className="text-zinc-400">•</span>;
  }
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-6xl px-4 py-12">
        <section className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white mb-2">
            {dict.home.title}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">{dict.home.description}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900">
              <p className="text-2xl font-bold text-black dark:text-white">{stats.platformCount}</p>
              <p className="text-sm text-zinc-500">{dict.home.stats.platforms}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900">
              <p className="text-2xl font-bold text-black dark:text-white">{stats.contentCount}</p>
              <p className="text-sm text-zinc-500">{dict.home.stats.contents}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900">
              <p className="text-2xl font-bold text-black dark:text-white">{stats.changeCount}</p>
              <p className="text-sm text-zinc-500">{dict.home.stats.changes}</p>
            </div>
            {stats.cheapestPlan && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900">
                <p className="text-2xl font-bold text-emerald-600">
                  R$ {stats.cheapestPlan.price.toFixed(2)}
                </p>
                <p className="text-sm text-zinc-500">
                  {dict.home.cheapest}: {stats.cheapestPlan.platform.name}
                </p>
              </div>
            )}
          </div>
        </section>

        {comparison.cheapest.length > 0 && (
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-black dark:text-white mb-4">
              💰 Comparação de Preços
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900">
                <h3 className="text-sm font-medium text-zinc-500 mb-3">Planos mais baratos</h3>
                <div className="space-y-2">
                  {comparison.cheapest.map((plan) => (
                    <Link
                      key={plan.id}
                      href={`/${lang}/platforms/${plan.platform.slug}`}
                      className="flex items-center justify-between text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 -mx-2 px-2 py-1 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <PlatformLogo platform={plan.platform} size="sm" />
                        <span className="text-black dark:text-white">{plan.platform.name}</span>
                        <span className="text-zinc-400">· {plan.name}</span>
                      </div>
                      <span className="font-medium tabular-nums text-black dark:text-white">
                        R$ {plan.price.toFixed(2)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900">
                <h3 className="text-sm font-medium text-zinc-500 mb-3">Sem anúncios (mais baratos)</h3>
                <div className="space-y-2">
                  {comparison.cheapestNoAds.map((plan) => (
                    <Link
                      key={plan.id}
                      href={`/${lang}/platforms/${plan.platform.slug}`}
                      className="flex items-center justify-between text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 -mx-2 px-2 py-1 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <PlatformLogo platform={plan.platform} size="sm" />
                        <span className="text-black dark:text-white">{plan.platform.name}</span>
                        <span className="text-zinc-400">· {plan.name}</span>
                      </div>
                      <span className="font-medium tabular-nums text-black dark:text-white">
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-black dark:text-white">{dict.nav.platforms}</h2>
            <Link
              href={`/${lang}/platforms`}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Ver todas →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {platforms.map((p) => (
              <Link
                key={p.id}
                href={`/${lang}/platforms/${p.slug}`}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <PlatformLogo platform={p} size="md" />
                  <span className="font-medium text-sm text-black dark:text-white truncate">
                    {p.name}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {p.plans.length} {dict.platforms.plans} · {p._count.availability}{" "}
                  {dict.platforms.contentCount}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-black dark:text-white">{dict.nav.changes}</h2>
            <Link
              href={`/${lang}/changes`}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Ver todas →
            </Link>
          </div>
          <div className="space-y-2">
            {changes.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900 text-sm"
              >
                <ChangeIcon type={c.type} />
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
