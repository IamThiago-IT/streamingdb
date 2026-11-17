import "server-only";
import { cookies } from "next/headers";
import {
  COUNTRY_COOKIE,
  defaultCountry,
  isCountry,
  type CountryCode,
} from "./countries";

/**
 * País selecionado pelo usuário. O cookie é semeado no proxy.ts a partir da
 * geolocalização (Vercel) ou do idioma; aqui só validamos e lemos.
 */
export async function getSelectedCountry(): Promise<CountryCode> {
  const store = await cookies();
  const value = store.get(COUNTRY_COOKIE)?.value;
  return isCountry(value) ? value : defaultCountry;
}
