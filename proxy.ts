import { NextResponse } from "next/server";

const locales = ["en", "pt-BR"];
const defaultLocale = "pt-BR";

function getLocale(request: Request): string {
  const acceptLang = request.headers.get("Accept-Language");
  if (!acceptLang) return defaultLocale;

  if (acceptLang.startsWith("pt")) return "pt-BR";
  return "en";
}

export function proxy(request: Request) {
  const url = new URL(request.url);
  const { pathname } = url;

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return;

  const locale = getLocale(request);
  url.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|favicon\\.ico).*)"],
};
