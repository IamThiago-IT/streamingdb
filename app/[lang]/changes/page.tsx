import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/dictionaries";
import type { Locale } from "@/lib/locales";
import { getRecentChanges } from "@/lib/queries";
import Header from "@/components/Header";
import ChangeFilter from "@/components/ChangeFilter";
import { getSelectedCountry } from "@/lib/country";
import { getCountryName } from "@/lib/countries";

function ChangeBadge({ type, label }: { type: string; label: string }) {
  const styles: Record<string, string> = {
    PRICE_CHANGE: "bg-warn-soft text-warn",
    CONTENT_ADDED: "bg-fall-soft text-fall",
    CONTENT_REMOVED: "bg-rise-soft text-rise",
    NEW_PLATFORM: "bg-accent-soft text-accent",
    PLAN_CHANGE: "bg-surface-2 text-ink-muted",
  };

  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${
        styles[type] ?? "bg-surface-2 text-ink-muted"
      }`}
    >
      {label}
    </span>
  );
}

function groupByDate(
  changes: Awaited<ReturnType<typeof getRecentChanges>>,
  lang: string
) {
  const groups: Record<string, typeof changes> = {};
  for (const c of changes) {
    const key = new Date(c.createdAt).toLocaleDateString(lang);
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

  const dict = await getDictionary(lang as Locale);
  const country = await getSelectedCountry();
  const countryName = getCountryName(country, lang);
  const type = typeof sp.type === "string" ? sp.type : undefined;
  const changes = await getRecentChanges(country, type, 50);
  const grouped = groupByDate(changes, lang);
  const changeTypes = [
    { value: "", label: dict.changes.all },
    ...Object.entries(dict.changes.types).map(([value, label]) => ({ value, label })),
  ];

  return (
    <div className="min-h-screen bg-paper">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="mb-1 text-3xl text-ink">
          {dict.changes.title}
        </h1>
        <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          {dict.country.changesFor} {countryName}
        </p>

        <ChangeFilter lang={lang} types={changeTypes} />

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
                    <ChangeBadge type={c.type} label={dict.changes.types[c.type as keyof typeof dict.changes.types] ?? c.type} />
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
                    {new Date(c.createdAt).toLocaleTimeString(lang, {
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
