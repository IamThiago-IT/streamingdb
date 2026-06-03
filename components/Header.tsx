import Link from "next/link";
import HeaderActions from "./HeaderActions";

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
        <nav className="flex items-center gap-5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <Link href={`/${lang}/platforms`} className="hover:text-zinc-900 dark:hover:text-zinc-200">Plataformas</Link>
          <Link href={`/${lang}/contents`} className="hover:text-zinc-900 dark:hover:text-zinc-200">Catálogo</Link>
          <Link href={`/${lang}/compare`} className="hover:text-zinc-900 dark:hover:text-zinc-200">Comparar</Link>
          <Link href={`/${lang}/changes`} className="hover:text-zinc-900 dark:hover:text-zinc-200">Mudanças</Link>
        </nav>
        <HeaderActions lang={lang} />
      </div>
    </header>
  );
}
