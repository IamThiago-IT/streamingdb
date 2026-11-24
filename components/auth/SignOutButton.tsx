"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignOutButton({
  lang,
  className,
  logoutLabel,
  logoutPending,
}: {
  lang: string;
  className?: string;
  logoutLabel: string;
  logoutPending: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await authClient.signOut();
    router.push(`/${lang}`);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className={
        className ??
        "rounded bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-line hover:text-ink disabled:opacity-60"
      }
    >
      {pending ? logoutPending : logoutLabel}
    </button>
  );
}
