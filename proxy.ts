import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { defaultLocale, locales } from "./lib/locales";
import type { Locale } from "./lib/locales";

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
    const url = request.nextUrl.clone();
    url.pathname = `/${getLocale(request)}${
      pathname === "/" ? "" : pathname
    }`;
    const response = NextResponse.redirect(url);
    response.headers.set("Vary", "Accept-Language");
    return response;
  }

  const [, lang, segment] = pathname.split("/");
  const sessionCookie = getSessionCookie(request);

  // Rota protegida: sem cookie → leva pro login.
  if (segment === "profile" && !sessionCookie) {
    return NextResponse.redirect(new URL(`/${lang}/login`, request.url));
  }

  // Quem já tem cookie não precisa ver login/registro.
  if (
    (segment === "login" || segment === "register") &&
    sessionCookie
  ) {
    return NextResponse.redirect(new URL(`/${lang}`, request.url));
  }

  return NextResponse.next();
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
