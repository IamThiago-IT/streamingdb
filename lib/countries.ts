export const COUNTRY_COOKIE = "sdb_country";

/**
 * Países com coleta de preço nativo. A moeda é derivada do país — preço
 * nativo não é uma dimensão de moeda (EUR na Alemanha ≠ EUR em Portugal).
 */
export const countries = [
  { code: "BR", currency: "BRL" },
  { code: "US", currency: "USD" },
  { code: "CA", currency: "CAD" },
  { code: "GB", currency: "GBP" },
  { code: "AU", currency: "AUD" },
  { code: "MX", currency: "MXN" },
  { code: "DE", currency: "EUR" },
  { code: "PT", currency: "EUR" },
  { code: "ES", currency: "EUR" },
  { code: "JP", currency: "JPY" },
  { code: "IN", currency: "INR" },
  { code: "KR", currency: "KRW" },
] as const satisfies readonly { code: string; currency: string }[];

export type Country = (typeof countries)[number];
export type CountryCode = Country["code"];

export const defaultCountry: CountryCode = "BR";

export const countryCodes = countries.map((country) => country.code);

export function isCountry(
  value: string | null | undefined
): value is CountryCode {
  return (
    typeof value === "string" &&
    countries.some((country) => country.code === value)
  );
}

export function getCountry(code: string): Country {
  return (
    countries.find((country) => country.code === code) ?? countries[0]
  );
}

export function getCountryCurrency(code: string): string {
  return getCountry(code).currency;
}

/** Nome localizado do país via Intl — não precisa manter dicionário. */
export function getCountryName(code: string, locale: string): string {
  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

/** Bandeira em emoji a partir do código ISO (funciona em qualquer locale). */
export function getCountryFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );
}

/** Fallback de país quando ainda não há cookie nem header de geolocalização. */
export function countryForLocale(locale: string): CountryCode {
  if (locale === "pt-BR") return "BR";
  if (locale === "es") return "ES";
  return "US";
}
