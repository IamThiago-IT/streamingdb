"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Header from "@/components/Header";
import { useDictionary } from "../dictionaries";

export default function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [lang, setLang] = useState("");
  const dict = useDictionary(lang as string);

  params.then((p) => setLang(p.lang));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message ?? "Erro ao entrar");
      return;
    }

    router.push(`/${lang}`);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <Header lang={lang} title={dict?.home?.title ?? "StreamingDB"} />

      <main className="mx-auto max-w-sm px-4 py-24">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
          <h1 className="text-xl font-bold text-black dark:text-white mb-6 text-center">
            Entrar no StreamingDB
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-black dark:text-white placeholder-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-black dark:text-white placeholder-zinc-400"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Entrar
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-zinc-500">
            Ainda não tem conta?{" "}
            <Link href={`/${lang}/register`} className="text-blue-600 dark:text-blue-400 hover:underline">
              Cadastre-se
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-400">
          <Link href={`/${lang}`} className="hover:underline">← Voltar ao início</Link>
        </p>
      </main>
    </div>
  );
}
