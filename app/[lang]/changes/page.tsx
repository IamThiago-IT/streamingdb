import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "../dictionaries";
import { getRecentChanges } from "@/lib/queries";
import Header from "@/components/Header";
import ChangeFilter from "@/components/ChangeFilter";

function ChangeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    PRICE_CHANGE: "bg-warn-soft text-warn",
    CONTENT_ADDED: "bg-fall-soft text-fall",
    CONTENT_REMOVED: "bg-rise-soft text-rise",
    NEW_PLATFORM: "bg-accent-soft text-accent",
    PLAN_CHANGE: "bg-surface-2 text-ink-muted",
  };

  const labels: Record<string, string> = {
    PRICE_CHANGE: "Preço",
    CONTENT_ADDED: "Adicionado",
    CONTENT_REMOVED: "Removido",
    NEW_PLATFORM: "Novo",
    PLAN_CHANGE: "Plano",
  };

  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${
        styles[type] ?? "bg-surface-2 text-ink-muted"
      }`}
    >
      {labels[type] ?? type}
    </span>
  );
}

function groupByDate(changes: Awaited<ReturnType<typeof getRecentChanges>>) {
  const groups: Record<string, typeof changes> = {};
  for (const c of changes) {
    const key = new Date(c.createdAt).toLocaleDateString("pt-BR");
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  return groups;
}

export default async function ChangesPage({
  params,
  searchParams,
}: PageProps<"/[lang]">) {
  const { lang } = await params;
  const sp = await searchParams;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const type = typeof sp.type === "string" ? sp.type : undefined;
  const changes = await getRecentChanges(type, 50);
  const grouped = groupByDate(changes);

  return (
    <div className="min-h-screen bg-paper">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="mb-6 text-3xl text-ink">
          {dict.changes.title}
        </h1>

        <ChangeFilter lang={lang} />

        {Object.keys(grouped).length === 0 && (
          <p className="py-12 text-center text-ink-muted">{dict.changes.noChanges}</p>
        )}

        {Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="mb-8">
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">{date}</h2>
            <div className="grid gap-2">
              {items.map((c) => (
                <div
                  key={c.id}
                  className="flex min-w-0 items-start gap-3 rounded-md border border-line bg-surface px-4 py-3"
                >
                  <span className="mt-0.5 flex-shrink-0">
                    <ChangeBadge type={c.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-ink-muted">
                      {c.description}
                    </p>
                    {c.platform && (
                      <Link
                        href={`/${lang}/platforms/${c.platform.slug}`}
                        className="text-xs font-medium text-accent hover:text-accent-hover hover:underline"
                      >
                        {c.platform.name}
                      </Link>
                    )}
                  </div>
                  <span className="mt-0.5 flex-shrink-0 font-mono text-[11px] tnum text-ink-faint">
                    {new Date(c.createdAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
