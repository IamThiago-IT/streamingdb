"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import SocialAuthButtons from "./SocialAuthButtons";
import type { SocialProvider } from "@/lib/auth-providers";

export default function RegisterForm({
  lang,
  providers,
}: {
  lang: string;
  providers: SocialProvider[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);

    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message ?? "Erro ao cadastrar");
      setPending(false);
      return;
    }

    router.push(`/${lang}`);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-muted">
            Nome
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-muted">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-muted">
            Senha
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
          />
          <p className="mt-1 text-xs text-ink-faint">Mínimo de 8 caracteres.</p>
        </div>
        {error && <p className="text-sm text-rise">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-accent py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Cadastrando..." : "Cadastrar"}
        </button>
      </form>

      <SocialAuthButtons providers={providers} callbackURL={`/${lang}`} />

      <p className="mt-6 text-center text-xs text-ink-muted">
        Já tem conta?{" "}
        <Link
          href={`/${lang}/login`}
          className="font-medium text-accent hover:text-accent-hover hover:underline"
        >
          Entrar
        </Link>
      </p>
    </>
  );
}
