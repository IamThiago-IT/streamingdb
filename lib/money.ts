type MoneyInput = number | string | { toString(): string };

function toNumber(amount: MoneyInput): number {
  if (typeof amount === "number") return amount;
  return Number(amount.toString());
}

/**
 * Formata um valor monetário no locale do site. A moeda vem do país da
 * oferta — não há conversão cambial. Intl resolve símbolo, separadores e
 * moedas sem centavos (JPY/KRW).
 */
export function formatMoney(
  amount: MoneyInput,
  currency: string,
  locale: string,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...options,
  }).format(toNumber(amount));
}

/** Símbolo da moeda no locale (ex.: "R$", "US$", "€"). */
export function currencySymbol(currency: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);

    return (
      parts.find((part) => part.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}

/** Valor mensal equivalente, para comparar planos com ciclos diferentes. */
export function monthlyAmount(
  amount: MoneyInput,
  billingMonths: number
): number {
  return toNumber(amount) / (billingMonths > 0 ? billingMonths : 1);
}
