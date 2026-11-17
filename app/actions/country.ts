"use server";

import { cookies } from "next/headers";
import { COUNTRY_COOKIE, isCountry } from "@/lib/countries";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setCountryAction(code: string) {
  if (!isCountry(code)) return;

  const store = await cookies();
  store.set(COUNTRY_COOKIE, code, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
}
