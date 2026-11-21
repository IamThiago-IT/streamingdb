"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import PlatformLogo from "@/components/PlatformLogo";

const MAX_PLATFORMS = 3;

export type ComparePlatformOption = {
  slug: string;
  name: string;
  logo: string | null;
  color: string | null;
  unavailable: boolean;
};

export type ComparePickerLabels = {
  pick: string;
  selectedCount: string;
  compare: string;
  loading: string;
  clear: string;
  hint: string;
  max: string;
  unavailable: string;
};

/**
 * Seleção de plataformas para comparar. Usa estado local e navega com a URL
 * (`?platforms=a,b`), que é a fonte da verdade lida pela página no servidor.
 * Os inputs escondidos mantêm o formulário funcional sem JavaScript.
 */
export default function ComparePicker({
  lang,
  platforms,
  initialSelected,
  labels,
}: {
  lang: string;
  platforms: ComparePlatformOption[];
  initialSelected: string[];
  labels: ComparePickerLabels;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialSelected.slice(0, MAX_PLATFORMS));
  const [isPending, startTransition] = useTransition();

  const atLimit = selected.length >= MAX_PLATFORMS;
  const canCompare = selected.length >= 2;

  function toggle(slug: string) {
    setSelected((current) => {
      if (current.includes(slug)) {
        return current.filter((item) => item !== slug);
      }
      if (current.length >= MAX_PLATFORMS) return current;
      return [...current, slug];
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCompare) return;

    const query = selected.map(encodeURIComponent).join(",");
    startTransition(() => {
      router.push(`/${lang}/compare?platforms=${query}`);
    });
  }

  return (
    <form
      action={`/${lang}/compare`}
      method="get"
      onSubmit={handleSubmit}
      className="mb-8 rounded-md border border-line bg-surface p-4 sm:p-5"
    >
      {selected.map((slug) => (
        <input key={slug} type="hidden" name="platforms" value={slug} />
      ))}

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
          {labels.pick}
        </p>
        <p
          aria-live="polite"
          className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
            atLimit ? "text-warn" : "text-ink-faint"
          }`}
        >
          {labels.selectedCount.replace("{count}", String(selected.length))}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {platforms.map((platform) => {
          const isSelected = selected.includes(platform.slug);
          const isDisabled = !isSelected && atLimit;

          return (
            <button
              key={platform.slug}
              type="button"
              aria-pressed={isSelected}
              disabled={isDisabled}
              onClick={() => toggle(platform.slug)}
              className={`flex min-w-0 items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
              } ${isDisabled ? "cursor-not-allowed opacity-40" : ""}`}
            >
              <PlatformLogo
                name={platform.name}
                logo={platform.logo}
                color={platform.color}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">
                  {platform.name}
                </span>
                {platform.unavailable && (
                  <span className="mt-0.5 block truncate text-[10px] text-rise">
                    {labels.unavailable}
                  </span>
                )}
              </span>
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border text-[10px] font-semibold leading-none ${
                  isSelected
                    ? "border-accent bg-accent text-on-accent"
                    : "border-line-strong bg-surface text-transparent"
                }`}
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canCompare || isPending}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? labels.loading : labels.compare}
        </button>

        {selected.length > 0 && (
          <Link
            href={`/${lang}/compare`}
            className="rounded border border-line px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            {labels.clear}
          </Link>
        )}

        {!canCompare && <p className="text-xs text-ink-faint">{labels.hint}</p>}
        {atLimit && <p className="text-xs text-warn">{labels.max}</p>}
      </div>
    </form>
  );
}
