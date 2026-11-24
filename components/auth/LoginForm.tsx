"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import SocialAuthButtons from "./SocialAuthButtons";
import type { SocialProvider } from "@/lib/auth-providers";

type LoginStrings = {
  email: string;
  password: string;
  submit: string;
  pending: string;
  error: string;
  noAccount: string;
  register: string;
  socialDivider: string;
  socialError: string;
};

export default function LoginForm({
  lang,
  providers,
  strings,
}: {
  lang: string;
  providers: SocialProvider[];
  strings: LoginStrings;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message ?? strings.error);
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
            {strings.email}
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
            {strings.password}
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
          />
        </div>
        {error && <p className="text-sm text-rise">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-accent py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? strings.pending : strings.submit}
        </button>
      </form>

      <SocialAuthButtons
        providers={providers}
        callbackURL={`/${lang}`}
        socialDivider={strings.socialDivider}
        socialError={strings.socialError}
      />

      <p className="mt-6 text-center text-xs text-ink-muted">
        {strings.noAccount}{" "}
        <Link
          href={`/${lang}/register`}
          className="font-medium text-accent hover:text-accent-hover hover:underline"
        >
          {strings.register}
        </Link>
      </p>
    </>
  );
}
