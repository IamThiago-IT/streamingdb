import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const plans = await prisma.plan.findMany({
    include: {
      platform: true,
      priceHistory: { orderBy: { recordedAt: "desc" }, take: 1 },
    },
    orderBy: { price: "asc" },
  });

  return NextResponse.json(plans);
}
