import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { defaultCountry, getCountry, isCountry } from "@/lib/countries";
import { monthlyAmount } from "@/lib/money";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("country");
  const countryCode = isCountry(requested) ? requested : defaultCountry;

  const offers = await prisma.planOffer.findMany({
    where: {
      countryCode,
      status: { in: ["ACTIVE", "STALE"] },
    },
    include: {
      plan: { include: { platform: true } },
      history: { orderBy: { recordedAt: "desc" }, take: 1 },
    },
  });

  offers.sort(
    (a, b) =>
      monthlyAmount(a.amount, a.billingMonths) -
      monthlyAmount(b.amount, b.billingMonths)
  );

  return NextResponse.json({
    country: countryCode,
    currency: getCountry(countryCode).currency,
    offers,
  });
}
