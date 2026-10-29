import { NextResponse } from "next/server";

const locales = ["en", "pt-BR"];
const defaultLocale = "pt-BR";
const PUBLIC_FILE = /\.[^/]+$/;

function getLocale(request: Request): string {
  const acceptLang = request.headers.get("Accept-Language");
  if (!acceptLang) return defaultLocale;

  if (acceptLang.startsWith("pt")) return "pt-BR";
  return "en";
}

export function proxy(request: Request) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return;
  }

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return;

  const locale = getLocale(request);
  url.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|api|favicon\\.ico|.*\\..*).*)"],
};
