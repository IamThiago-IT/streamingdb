import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "../dictionaries";
import { getPlatforms } from "@/lib/queries";
import Header from "@/components/Header";
import PlatformLogo from "@/components/PlatformLogo";

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
    <div className="min-h-screen bg-paper">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="mb-6 text-3xl text-ink">{dict.platforms.title}</h1>

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
              {sorted.map((p, i) => {
                const minPrice = Math.min(...p.plans.map((pl) => pl.price));
                return (
                  <tr
                    key={p.id}
                    className="transition-colors hover:bg-surface-2"
                  >
                    <td className="px-4 py-3 font-mono text-xs tnum text-ink-faint">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${lang}/platforms/${p.slug}`}
                        className="flex items-center gap-3 font-medium text-ink"
                      >
                        <PlatformLogo platform={p} size="md" />
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tnum text-ink-muted">{p.plans.length}</td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] tnum text-ink">
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
