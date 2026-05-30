import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const platforms = await prisma.platform.findMany({
    include: {
      plans: true,
      _count: { select: { availability: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(platforms);
}
