import Link from "next/link";

export default function Header({
  lang,
  title,
}: {
  lang: string;
  title: string;
}) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
        <Link
          href={`/${lang}`}
          className="text-xl font-bold tracking-tight text-black dark:text-white"
        >
          {title}
        </Link>
        <nav className="flex gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <Link href={`/${lang}/platforms`}>Plataformas</Link>
          <Link href={`/${lang}/contents`}>Catálogo</Link>
          <Link href={`/${lang}/changes`}>Mudanças</Link>
        </nav>
      </div>
    </header>
  );
}
