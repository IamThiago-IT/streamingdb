import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "../dictionaries";
import { getRecentChanges } from "@/lib/queries";

async function ChangeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    PRICE_CHANGE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    CONTENT_ADDED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    CONTENT_REMOVED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    NEW_PLATFORM: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    PLAN_CHANGE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };

  const labels: Record<string, string> = {
    PRICE_CHANGE: "Preço",
    CONTENT_ADDED: "Adicionado",
    CONTENT_REMOVED: "Removido",
    NEW_PLATFORM: "Novo",
    PLAN_CHANGE: "Plano",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[type] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>
      {labels[type] ?? type}
    </span>
  );
}

export default async function ChangesPage({
  params,
}: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const changes = await getRecentChanges(50);

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
        <h1 className="text-2xl font-bold text-black dark:text-white mb-6">{dict.changes.title}</h1>

        <div className="space-y-2">
          {changes.length === 0 && (
            <p className="text-zinc-500 text-center py-12">{dict.changes.noChanges}</p>
          )}
          {changes.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900"
            >
              <ChangeBadge type={c.type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{c.description}</p>
                {c.platform && (
                  <Link
                    href={`/${lang}/platforms/${c.platform.slug}`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {c.platform.name}
                  </Link>
                )}
              </div>
              <span className="text-xs text-zinc-400 flex-shrink-0">
                {new Date(c.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
