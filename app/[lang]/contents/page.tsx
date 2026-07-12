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
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-2xl font-bold text-black dark:text-white mb-6">{dict.contents.title}</h1>

        <form className="flex flex-wrap gap-3 mb-8">
          <input
            name="q"
            defaultValue={query}
            placeholder={dict.contents.searchPlaceholder}
            className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm text-black dark:text-white placeholder-zinc-400"
          />
          <select
            name="type"
            defaultValue={type}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-black dark:text-white"
          >
            <option value="">{dict.contents.all}</option>
            <option value="MOVIE">{dict.contents.movies}</option>
            <option value="SERIES">{dict.contents.series}</option>
          </select>
          <select
            name="platform"
            defaultValue={platform}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-black dark:text-white"
          >
            <option value="">{dict.contents.all}</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.slug}>{p.name}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Filtrar
          </button>
        </form>

        <div className="grid gap-3">
          {contents.length === 0 && (
            <p className="text-zinc-500 text-center py-12">{dict.contents.noResults}</p>
          )}
          {contents.map((c) => (
            <Link
              key={c.id}
              href={`/${lang}/contents/${c.slug}`}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-black dark:text-white">{c.title}</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {c.type === "MOVIE" ? dict.content.type_movie : dict.content.type_series}
                    {c.year ? ` · ${c.year}` : ""}
                    {c.genre ? ` · ${c.genre}` : ""}
                  </p>
                </div>
                {c.rating && (
                  <span className="text-sm font-medium text-amber-500">★ {c.rating.toFixed(1)}</span>
                )}
              </div>
              {c.availability.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {c.availability.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: (a.platform.color ?? "#666") + "20",
                        color: a.platform.color ?? "#666",
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
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/${lang}/contents?page=${p}${query ? `&q=${query}` : ""}${type ? `&type=${type}` : ""}${platform ? `&platform=${platform}` : ""}`}
                className={`flex h-8 w-8 items-center justify-center rounded text-sm ${
                  p === page
                    ? "bg-blue-600 text-white"
                    : "border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
