import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "../dictionaries";
import { getPlatforms } from "@/lib/queries";

export default async function PlatformsPage({
  params,
}: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const platforms = await getPlatforms();

  const sorted = [...platforms].sort(
    (a, b) => Math.min(...a.plans.map((p) => p.price)) - Math.min(...b.plans.map((p) => p.price))
  );

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
        <h1 className="text-2xl font-bold text-black dark:text-white mb-6">{dict.platforms.title}</h1>

        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">{dict.platforms.title}</th>
                <th className="text-left px-4 py-3 font-medium">{dict.platforms.plans}</th>
                <th className="text-right px-4 py-3 font-medium">{dict.platforms.price}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sorted.map((p, i) => {
                const minPrice = Math.min(...p.plans.map((pl) => pl.price));
                return (
                  <tr
                    key={p.id}
                    className="bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3 text-zinc-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${lang}/platforms/${p.slug}`}
                        className="flex items-center gap-3 font-medium text-black dark:text-white"
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: p.color ?? "#666" }}
                        />
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{p.plans.length}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-black dark:text-white">
                      R$ {minPrice.toFixed(2)}
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
