import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ platforms: [], contents: [] });
  }

  const [platforms, contents] = await Promise.all([
    prisma.platform.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: 5,
    }),
    prisma.content.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { originalTitle: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        availability: {
          include: { platform: true },
          take: 3,
        },
      },
      take: 10,
    }),
  ]);

  return NextResponse.json({ platforms, contents });
}
