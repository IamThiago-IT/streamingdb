import Link from "next/link";
import { Fragment } from "react";
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
    <div className="min-h-screen bg-paper">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="mb-6 text-3xl text-ink">
          Comparar plataformas
        </h1>

        <form className="mb-8 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
              Plataformas
            </label>
            <select
              name="platforms"
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink"
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
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            Comparar
          </button>
        </form>

        {selected.length > 1 && (
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className="w-40 px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                    Característica
                  </th>
                  {selected.map((p) => (
                    <th
                      key={p.id}
                      className="px-4 py-3 text-left font-medium text-ink"
                    >
                      <Link
                        href={`/${lang}/platforms/${p.slug}`}
                        className="flex items-center gap-2 hover:text-accent"
                      >
                        <PlatformLogo platform={p} size="sm" />
                        {p.name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr className="bg-surface">
                  <td className="px-4 py-3 text-ink-muted">Preço mínimo</td>
                  {selected.map((p) => {
                    const min = Math.min(...p.plans.map((pl) => pl.price));
                    return (
                      <td key={p.id} className="px-4 py-3 font-mono text-[13px] tnum text-ink">
                        R$ {min.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-surface-2">
                  <td className="px-4 py-3 text-ink-muted">Planos disponíveis</td>
                  {selected.map((p) => (
                    <td key={p.id} className="px-4 py-3 font-mono text-[13px] tnum text-ink">
                      {p.plans.length}
                    </td>
                  ))}
                </tr>
                <tr className="bg-surface">
                  <td className="px-4 py-3 text-ink-muted">Conteúdos no catálogo</td>
                  {selected.map((p) => (
                    <td key={p.id} className="px-4 py-3 font-mono text-[13px] tnum text-ink">
                      {p._count.availability}
                    </td>
                  ))}
                </tr>
                <tr className="bg-surface-2">
                  <td className="px-4 py-3 text-ink-muted">Qualidade máxima</td>
                  {selected.map((p) => {
                    const qualities = p.plans.map((pl) => pl.quality).filter(Boolean);
                    const max = [...new Set(qualities)].sort().reverse()[0] ?? "HD";
                    return (
                      <td key={p.id} className="px-4 py-3 text-ink">
                        {max}
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-surface">
                  <td className="px-4 py-3 text-ink-muted">Plano com anúncios</td>
                  {selected.map((p) => {
                    const hasAds = p.plans.some((pl) => pl.ads);
                    return (
                      <td key={p.id} className="px-4 py-3">
                        {hasAds ? (
                          <span className="text-warn">Sim</span>
                        ) : (
                          <span className="text-fall">Não</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {selected.map((p) => (
                  <Fragment key={p.id}>
                    <tr className="bg-surface-2">
                      <td
                        colSpan={selected.length + 1}
                        className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint"
                      >
                        {p.name} · {p.plans.length} {p.plans.length === 1 ? "plano" : "planos"}
                      </td>
                    </tr>
                    {p.plans.map((plan) => (
                      <tr key={plan.id} className="bg-surface">
                        <td className="py-2 pl-8 pr-4 text-xs text-ink-faint">{plan.name}</td>
                        <td
                          colSpan={selected.length}
                          className="px-4 py-2 font-mono text-[13px] tnum text-ink"
                        >
                          R$ {plan.price.toFixed(2)}/{plan.billingCycle === "anual" ? "ano" : "mês"}
                          {plan.ads ? " · com anúncios" : ""}
                          {plan.quality ? ` · ${plan.quality}` : ""}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected.length === 0 && (
          <div className="py-20 text-center">
            <p className="mb-2 text-lg text-ink-muted">Selecione pelo menos 2 plataformas</p>
            <p className="text-sm text-ink-faint">Escolha no menu acima e clique em &quot;Comparar&quot;</p>
          </div>
        )}

        {selected.length === 1 && (
          <p className="py-12 text-center text-ink-muted">Selecione mais uma plataforma para comparar</p>
        )}
      </main>
    </div>
  );
}
