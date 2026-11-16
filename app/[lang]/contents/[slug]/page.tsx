import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "../../dictionaries";
import { getContentBySlug } from "@/lib/queries";
import Header from "@/components/Header";
import PlatformLogo from "@/components/PlatformLogo";

export default async function ContentDetail({
  params,
}: PageProps<"/[lang]"> & { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const content = await getContentBySlug(slug);

  if (!content) notFound();

  return (
    <div className="min-h-screen bg-paper">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl text-ink">{content.title}</h1>
          {content.originalTitle && content.originalTitle !== content.title && (
            <p className="mt-1 text-ink-muted">{content.originalTitle}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink-faint">
            <span>{content.type === "MOVIE" ? dict.content.type_movie : dict.content.type_series}</span>
            {content.year && <span>· {dict.content.year}: {content.year}</span>}
            {content.genre && <span>· {dict.content.genre}: {content.genre}</span>}
            {content.rating && <span>· {dict.content.rating}: ★ {content.rating.toFixed(1)}</span>}
          </div>
        </div>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl text-ink">{dict.content.availability}</h2>
          <div className="grid gap-2">
            {content.availability.length === 0 && (
              <p className="text-sm text-ink-muted">{dict.contents.noResults}</p>
            )}
            {content.availability.map((a) => (
              <Link
                key={a.id}
                href={`/${lang}/platforms/${a.platform.slug}`}
                className="flex min-w-0 items-center justify-between rounded-md border border-line bg-surface p-4 transition-colors hover:border-line-strong"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <PlatformLogo platform={a.platform} size="md" />
                  <span className="truncate font-medium text-ink">{a.platform.name}</span>
                </div>
                <span className="font-mono text-xs tnum text-ink-faint">
                  {new Date(a.addedAt).toLocaleDateString("pt-BR")}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {content.changeLog.length > 0 && (
          <section>
            <h2 className="mb-4 text-2xl text-ink">{dict.content.changes}</h2>
            <div className="grid gap-2">
              {content.changeLog.map((c) => (
                <div
                  key={c.id}
                  className="flex min-w-0 items-start gap-3 rounded-md border border-line bg-surface px-4 py-3 text-sm"
                >
                  <span className="min-w-0 flex-1 leading-snug text-ink-muted">{c.description}</span>
                  <span className="mt-0.5 flex-shrink-0 font-mono text-xs tnum text-ink-faint">
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
