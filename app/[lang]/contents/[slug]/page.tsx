import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "../../dictionaries";
import { getContentBySlug } from "@/lib/queries";
import Header from "@/components/Header";

export default async function ContentDetail({
  params,
}: PageProps<"/[lang]"> & { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const content = await getContentBySlug(slug);

  if (!content) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-black dark:text-white">{content.title}</h1>
          {content.originalTitle && content.originalTitle !== content.title && (
            <p className="text-zinc-500 mt-1">{content.originalTitle}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-3 text-sm text-zinc-500">
            <span>{content.type === "MOVIE" ? dict.content.type_movie : dict.content.type_series}</span>
            {content.year && <span>· {dict.content.year}: {content.year}</span>}
            {content.genre && <span>· {dict.content.genre}: {content.genre}</span>}
            {content.rating && <span>· {dict.content.rating}: ★ {content.rating.toFixed(1)}</span>}
          </div>
        </div>

        <section className="mb-10">
          <h2 className="text-lg font-semibold text-black dark:text-white mb-4">{dict.content.availability}</h2>
          <div className="grid gap-3">
            {content.availability.length === 0 && (
              <p className="text-zinc-500 text-sm">{dict.contents.noResults}</p>
            )}
            {content.availability.map((a) => (
              <Link
                key={a.id}
                href={`/${lang}/platforms/${a.platform.slug}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: a.platform.color ?? "#666" }}
                  />
                  <span className="font-medium text-black dark:text-white">{a.platform.name}</span>
                </div>
                <span className="text-xs text-zinc-400">
                  {new Date(a.addedAt).toLocaleDateString("pt-BR")}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {content.changeLog.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-black dark:text-white mb-4">{dict.content.changes}</h2>
            <div className="space-y-2">
              {content.changeLog.map((c) => (
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
        )}
      </main>
    </div>
  );
}
