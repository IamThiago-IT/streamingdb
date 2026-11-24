import "server-only";
import { isLocale } from "@/lib/locales";
import type { Locale } from "@/lib/locales";

const dictionaries = {
  en: () => import("../../dictionaries/en.json").then((m) => m.default),
  "pt-BR": () => import("../../dictionaries/pt-BR.json").then((m) => m.default),
  es: () => import("../../dictionaries/es.json").then((m) => m.default),
} as const;

export type { Locale };
export { locales } from "@/lib/locales";

export const hasLocale = isLocale;

export const getDictionary = async (locale: Locale) => dictionaries[locale]();
