"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export default function ChangeFilter({
  lang,
  types,
}: {
  lang: string;
  types: { value: string; label: string }[];
}) {
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
      {types.map((t) => (
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
