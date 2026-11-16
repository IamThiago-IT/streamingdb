import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Checagem otimística apenas pela presença do cookie de sessão (sem consulta ao
 * banco, como recomendado pelo Better Auth para proxy/middleware). A validação
 * real da sessão acontece em cada página/server action.
 */
export function proxy(request: NextRequest) {
  const [, lang = "pt-BR", segment] = request.nextUrl.pathname.split("/");
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
  matcher: ["/:lang/profile", "/:lang/login", "/:lang/register"],
};
