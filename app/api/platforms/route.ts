import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { defaultCountry, getCountry, isCountry } from "@/lib/countries";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("country");
  const countryCode = isCountry(requested) ? requested : defaultCountry;

  const platforms = await prisma.platform.findMany({
    include: {
      plans: {
        include: {
          offers: { where: { countryCode } },
        },
      },
      platformCountries: { where: { countryCode } },
      _count: { select: { availability: { where: { available: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    country: countryCode,
    currency: getCountry(countryCode).currency,
    platforms,
  });
}
