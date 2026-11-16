import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "../dictionaries";
import { getContents, getPlatforms } from "@/lib/queries";
import Header from "@/components/Header";
import PlatformLogo from "@/components/PlatformLogo";

export default async function ContentsPage({
  params,
  searchParams,
}: PageProps<"/[lang]">) {
  const { lang } = await params;
  const sp = await searchParams;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const platforms = await getPlatforms();

  const query = typeof sp.q === "string" ? sp.q : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  const platform = typeof sp.platform === "string" ? sp.platform : "";
  const page = typeof sp.page === "string" ? Math.max(1, parseInt(sp.page)) : 1;

  const { data: contents, pagination } = await getContents({
    query: query || undefined,
    type: type || undefined,
    platform: platform || undefined,
    page,
    limit: 20,
  });

  return (
    <div className="min-h-screen bg-paper">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="mb-6 text-3xl text-ink">{dict.contents.title}</h1>

        <form className="mb-8 flex flex-wrap gap-3">
          <input
            name="q"
            defaultValue={query}
            placeholder={dict.contents.searchPlaceholder}
            className="min-w-[200px] flex-1 rounded border border-line bg-surface px-4 py-2 text-sm text-ink placeholder:text-ink-faint"
          />
          <select
            name="type"
            defaultValue={type}
            className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="">{dict.contents.all}</option>
            <option value="MOVIE">{dict.contents.movies}</option>
            <option value="SERIES">{dict.contents.series}</option>
          </select>
          <select
            name="platform"
            defaultValue={platform}
            className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="">{dict.contents.all}</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.slug}>{p.name}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            Filtrar
          </button>
        </form>

        <div className="grid gap-2">
          {contents.length === 0 && (
            <p className="py-12 text-center text-ink-muted">{dict.contents.noResults}</p>
          )}
          {contents.map((c) => (
            <Link
              key={c.id}
              href={`/${lang}/contents/${c.slug}`}
              className="rounded-md border border-line bg-surface p-4 transition-colors hover:border-line-strong"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-ink">{c.title}</h3>
                  <p className="mt-1 text-xs text-ink-faint">
                    {c.type === "MOVIE" ? dict.content.type_movie : dict.content.type_series}
                    {c.year ? ` · ${c.year}` : ""}
                    {c.genre ? ` · ${c.genre}` : ""}
                  </p>
                </div>
                {c.rating && (
                  <span className="font-mono text-sm text-warn">★ {c.rating.toFixed(1)}</span>
                )}
              </div>
              {c.availability.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {c.availability.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium text-ink"
                      style={{
                        backgroundColor: (a.platform.color ?? "#666") + "18",
                      }}
                    >
                      <PlatformLogo platform={a.platform} size="sm" />
                      {a.platform.name}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>

        {pagination.totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/${lang}/contents?page=${p}${query ? `&q=${query}` : ""}${type ? `&type=${type}` : ""}${platform ? `&platform=${platform}` : ""}`}
                className={`flex h-8 w-8 items-center justify-center rounded font-mono text-xs tnum ${
                  p === page
                    ? "bg-accent text-on-accent"
                    : "border border-line text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
