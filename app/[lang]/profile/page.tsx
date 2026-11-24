import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Header from "@/components/Header";
import SignOutButton from "@/components/auth/SignOutButton";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";
import { getDictionary, hasLocale } from "@/lib/dictionaries";
import type { Locale } from "@/lib/locales";

export default async function ProfilePage({
  params,
}: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang as Locale);

  // Validação real da sessão no servidor (o proxy só faz checagem otimística).
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect(`/${lang}/login`);

  const { user } = session;

  const hasPassword = !!(await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { id: true },
  }));

  return (
    <div className="min-h-screen bg-paper">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-sm space-y-6 px-4 py-24">
        <div className="rounded-md border border-line bg-surface p-8">
          <h1 className="mb-6 text-center text-2xl text-ink">
            {dict.auth.profileTitle}
          </h1>

          <div className="flex items-center gap-3">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                className="h-10 w-10 rounded-full"
              />) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-mono text-sm font-medium text-on-accent">
                {(user.name ?? user.email)[0].toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {user.name ?? "Sem nome"}
              </p>
              <p className="truncate text-xs text-ink-faint">{user.email}</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <SignOutButton
              lang={lang}
              logoutLabel={dict.auth.logout}
              logoutPending={dict.auth.logoutPending}
            />
          </div>
        </div>

        <div className="rounded-md border border-line bg-surface p-8">
          <h2 className="mb-1 text-lg text-ink">
            {hasPassword ? "Alterar senha" : "Definir senha"}
          </h2>
          <p className="mb-4 text-xs text-ink-faint">
            {hasPassword
              ? "Você entrou com email e senha."
              : "Sua conta foi criada via Google/GitHub. Defina uma senha para também entrar com email."}
          </p>
          <ChangePasswordForm mode={hasPassword ? "change" : "set"} strings={dict.auth} />
        </div>
      </main>
    </div>
  );
}