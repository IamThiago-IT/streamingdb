"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setCountryAction } from "@/app/actions/country";
import {
  countries,
  getCountryCurrency,
  getCountryFlag,
  getCountryName,
} from "@/lib/countries";

export default function CountrySelector({
  current,
  lang,
}: {
  current: string;
  lang: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const label = lang.startsWith("pt") ? "País dos preços" : "Price country";

  const options = [...countries].sort((a, b) =>
    getCountryName(a.code, lang).localeCompare(
      getCountryName(b.code, lang),
      lang
    )
  );

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const code = event.target.value;
    startTransition(async () => {
      await setCountryAction(code);
      router.refresh();
    });
  }

  return (
    <label className="flex items-center gap-1.5" title={label}>
      <span className="sr-only">{label}</span>
      <select
        value={current}
        onChange={onChange}
        disabled={pending}
        className="h-8 max-w-[9.5rem] rounded bg-surface-2 px-2 text-xs font-medium text-ink-muted outline-none transition-colors hover:bg-line hover:text-ink disabled:opacity-60"
      >
        {options.map((country) => (
          <option key={country.code} value={country.code}>
            {getCountryFlag(country.code)} {country.code} ·{" "}
            {getCountryCurrency(country.code)}
          </option>
        ))}
      </select>
    </label>
  );
}
