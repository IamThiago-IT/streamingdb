"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const changeTypes = [
  { value: "", label: "Todos" },
  { value: "PRICE_CHANGE", label: "Preço" },
  { value: "CONTENT_ADDED", label: "Conteúdo adicionado" },
  { value: "CONTENT_REMOVED", label: "Conteúdo removido" },
  { value: "NEW_PLATFORM", label: "Nova plataforma" },
  { value: "PLAN_CHANGE", label: "Mudança de plano" },
];

export default function ChangeFilter({ lang }: { lang: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentType = searchParams.get("type") ?? "";

  const handleChange = useCallback(
    (type: string) => {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      router.push(`/${lang}/changes?${params.toString()}`);
    },
    [lang, router]
  );

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {changeTypes.map((t) => (
        <button
          key={t.value}
          onClick={() => handleChange(t.value)}
          className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
            currentType === t.value
              ? "bg-accent text-on-accent"
              : "bg-surface-2 text-ink-muted hover:bg-line hover:text-ink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
