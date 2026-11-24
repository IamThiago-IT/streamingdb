import Link from "next/link";
import HeaderActions from "./HeaderActions";
import { getSelectedCountry } from "@/lib/country";
import { getDictionary } from "@/lib/dictionaries";
import type { Dictionary, Locale } from "@/lib/dictionaries";

export default async function Header({
  lang,
  title,
}: {
  lang: string;
  title: string;
}) {
  const country = await getSelectedCountry();
  const dict = (await getDictionary(lang as Locale)) as Dictionary;

  const links = [
    { href: "platforms", label: dict.nav.platforms },
    { href: "contents", label: dict.nav.contents },
    { href: "compare", label: dict.nav.compare },
    { href: "changes", label: dict.nav.changes },
  ];

  return (
    <header className="border-b border-line">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-4 py-4">
          <Link
            href={`/${lang}`}
            className="font-serif text-2xl font-medium tracking-tight text-ink"
          >
            {title}
            <span className="text-accent">.</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-muted md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={`/${lang}/${link.href}`}
                className="transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <HeaderActions
            lang={lang}
            country={country}
            loginLabel={dict.auth.login}
            logoutLabel={dict.auth.logout}
            logoutPending={dict.auth.logoutPending}
          />
        </div>

        <nav className="flex items-center gap-5 overflow-x-auto pb-3 text-xs font-medium text-ink-muted md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={`/${lang}/${link.href}`}
              className="whitespace-nowrap transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
