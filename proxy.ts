import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { defaultLocale, locales } from "./lib/locales";
import type { Locale } from "./lib/locales";
import {
  COUNTRY_COOKIE,
  countryForLocale,
  isCountry,
} from "./lib/countries";

/** Idioma preferido do navegador, restrito aos locales suportados. */
function getLocale(request: NextRequest): Locale {
  const header = request.headers.get("accept-language");
  if (!header) return defaultLocale;

  const languages = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const quality = params.find((p) => p.trim().startsWith("q="));
      return {
        tag: tag.trim().toLowerCase(),
        weight: quality ? Number(quality.split("=")[1]) : 1,
      };
    })
    .filter(({ tag }) => tag.length > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const { tag } of languages) {
    if (tag === "pt" || tag.startsWith("pt-")) return "pt-BR";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }

  return defaultLocale;
}

function hasLocale(pathname: string): boolean {
  return locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );
}

/**
 * Semeia o país na primeira visita: geolocalização da Vercel quando
 * disponível, senão o idioma do navegador. O usuário pode trocar no header,
 * e aí o cookie passa a mandar.
 */
function withCountry(
  request: NextRequest,
  response: NextResponse,
  locale: Locale
): NextResponse {
  if (request.cookies.get(COUNTRY_COOKIE)?.value) return response;

  const geo = request.headers.get("x-vercel-ip-country");
  const country = isCountry(geo) ? geo : countryForLocale(locale);

  response.cookies.set(COUNTRY_COOKIE, country, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return response;
}

/**
 * Redireciona a raiz (e qualquer caminho sem idioma) para o locale do
 * navegador. Também faz a checagem otimística de sessão apenas pela presença
 * do cookie (sem consulta ao banco, como recomendado pelo Better Auth). A
 * validação real da sessão acontece em cada página/server action.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Arquivos estáticos, rotas internas e a API não têm prefixo de idioma.
  const lastSegment = pathname.split("/").pop() ?? "";
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    lastSegment.includes(".")
  ) {
    return NextResponse.next();
  }

  if (!hasLocale(pathname)) {
    const locale = getLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    const response = NextResponse.redirect(url);
    response.headers.set("Vary", "Accept-Language");
    return withCountry(request, response, locale);
  }

  const [, lang, segment] = pathname.split("/");
  const sessionCookie = getSessionCookie(request);

  // Rota protegida: sem cookie → leva pro login.
  if (segment === "profile" && !sessionCookie) {
    return withCountry(
      request,
      NextResponse.redirect(new URL(`/${lang}/login`, request.url)),
      lang as Locale
    );
  }

  // Quem já tem cookie não precisa ver login/registro.
  if (
    (segment === "login" || segment === "register") &&
    sessionCookie
  ) {
    return withCountry(
      request,
      NextResponse.redirect(new URL(`/${lang}`, request.url)),
      lang as Locale
    );
  }

  return withCountry(request, NextResponse.next(), lang as Locale);
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, exceto:
     * - api (rotas de API)
     * - _next (assets e imagem)
     * - favicon.ico, icon.png, sitemap.xml, robots.txt (metadados)
     */
    "/((?!api|_next|favicon.ico|icon.png|sitemap.xml|robots.txt).*)",
  ],
};
