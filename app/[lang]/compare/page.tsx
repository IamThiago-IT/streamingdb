import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "../dictionaries";
import { getPlatforms } from "@/lib/queries";
import Header from "@/components/Header";
import PlatformLogo from "@/components/PlatformLogo";

export default async function ComparePage({
  params,
  searchParams,
}: PageProps<"/[lang]">) {
  const { lang } = await params;
  const sp = await searchParams;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const platforms = await getPlatforms();

  const selectedSlugs =
    typeof sp.platforms === "string"
      ? sp.platforms.split(",").filter(Boolean)
      : [];

  const selected = platforms.filter((p) => selectedSlugs.includes(p.slug));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-2xl font-bold text-black dark:text-white mb-6">
          Comparar Plataformas
        </h1>

        <form className="flex flex-wrap items-end gap-3 mb-8">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Plataformas</label>
            <select
              name="platforms"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            >
              <option value="">Selecione até 3 plataformas</option>
              {platforms.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Comparar
          </button>
        </form>

        {selected.length > 1 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left px-4 py-3 text-zinc-500 font-medium w-40">Característica</th>
                  {selected.map((p) => (
                    <th
                      key={p.id}
                      className="px-4 py-3 text-left font-medium text-black dark:text-white"
                    >
                      <Link
                        href={`/${lang}/platforms/${p.slug}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <PlatformLogo platform={p} size="sm" />
                        {p.name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                <tr className="bg-white dark:bg-zinc-900">
                  <td className="px-4 py-3 text-zinc-500">Preço mínimo</td>
                  {selected.map((p) => {
                    const min = Math.min(...p.plans.map((pl) => pl.price));
                    return (
                      <td key={p.id} className="px-4 py-3 font-medium text-black dark:text-white">
                        R$ {min.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                  <td className="px-4 py-3 text-zinc-500">Planos disponíveis</td>
                  {selected.map((p) => (
                    <td key={p.id} className="px-4 py-3 text-black dark:text-white">
                      {p.plans.length}
                    </td>
                  ))}
                </tr>
                <tr className="bg-white dark:bg-zinc-900">
                  <td className="px-4 py-3 text-zinc-500">Conteúdos no catálogo</td>
                  {selected.map((p) => (
                    <td key={p.id} className="px-4 py-3 text-black dark:text-white">
                      {p._count.availability}
                    </td>
                  ))}
                </tr>
                <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                  <td className="px-4 py-3 text-zinc-500">Qualidade máxima</td>
                  {selected.map((p) => {
                    const qualities = p.plans.map((pl) => pl.quality).filter(Boolean);
                    const max = [...new Set(qualities)].sort().reverse()[0] ?? "HD";
                    return (
                      <td key={p.id} className="px-4 py-3 text-black dark:text-white">
                        {max}
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-white dark:bg-zinc-900">
                  <td className="px-4 py-3 text-zinc-500">Plano com anúncios</td>
                  {selected.map((p) => {
                    const hasAds = p.plans.some((pl) => pl.ads);
                    return (
                      <td key={p.id} className="px-4 py-3">
                        {hasAds ? (
                          <span className="text-amber-600">Sim</span>
                        ) : (
                          <span className="text-emerald-600">Não</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {selected.map((p) =>
                  p.plans.map((plan) => (
                    <tr key={plan.id} className="bg-white dark:bg-zinc-900">
                      <td className="px-4 py-2 text-xs text-zinc-400 pl-8">{plan.name}</td>
                      <td
                        colSpan={selected.length}
                        className="px-4 py-2 font-medium tabular-nums text-black dark:text-white"
                      >
                        R$ {plan.price.toFixed(2)}/{plan.billingCycle === "anual" ? "ano" : "mês"}
                        {plan.ads ? " · com anúncios" : ""}
                        {plan.quality ? ` · ${plan.quality}` : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {selected.length === 0 && (
          <div className="text-center py-20">
            <p className="text-zinc-400 text-lg mb-2">Selecione pelo menos 2 plataformas</p>
            <p className="text-zinc-500 text-sm">Escolha no menu acima e clique em &quot;Comparar&quot;</p>
          </div>
        )}

        {selected.length === 1 && (
          <p className="text-zinc-500 text-center py-12">Selecione mais uma plataforma para comparar</p>
        )}
      </main>
    </div>
  );
}
