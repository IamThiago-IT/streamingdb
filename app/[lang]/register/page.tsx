import Header from "@/components/Header";
import RegisterForm from "@/components/auth/RegisterForm";
import { getEnabledSocialProviders } from "@/lib/auth-providers";
import { getDictionary, hasLocale, Locale } from "@/lib/dictionaries";
import { notFound } from "next/navigation";

export default async function RegisterPage({
  params,
}: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang as Locale);
  const providers = getEnabledSocialProviders();

  return (
    <div className="min-h-screen bg-paper">
      <Header lang={lang} title={dict.home.title} />

      <main className="mx-auto max-w-sm px-4 py-24">
        <div className="rounded-md border border-line bg-surface p-8">
          <h1 className="mb-6 text-center text-2xl text-ink">
            {dict.auth.registerTitle}
          </h1>

          <RegisterForm lang={lang} providers={providers} strings={dict.auth} />
        </div>

        <p className="mt-4 text-center text-xs text-ink-faint">
          <a href={`/${lang}`} className="transition-colors hover:text-ink hover:underline">
            ← {dict.auth.backToHome}
          </a>
        </p>
      </main>
    </div>
  );
}