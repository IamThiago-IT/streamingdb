import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { defaultCountry, getCountry, isCountry } from "@/lib/countries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("country");
  const countryCode = isCountry(requested) ? requested : defaultCountry;

  const platform = await prisma.platform.findUnique({
    where: { slug },
    include: {
      plans: {
        include: {
          offers: {
            where: { countryCode },
            include: {
              history: { orderBy: { recordedAt: "desc" }, take: 20 },
            },
          },
        },
      },
      platformCountries: { where: { countryCode } },
      availability: {
        where: { available: true },
        include: { content: true },
        orderBy: { addedAt: "desc" },
        take: 50,
      },
      changeLog: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!platform) {
    return NextResponse.json({ error: "Platform not found" }, { status: 404 });
  }

  return NextResponse.json({
    country: countryCode,
    currency: getCountry(countryCode).currency,
    platform,
  });
}
