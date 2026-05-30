import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const platform = searchParams.get("platform");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "30")));

  const where: Record<string, unknown> = {};

  if (type) where.type = type;
  if (platform) where.platform = { slug: platform };

  const [changes, total] = await Promise.all([
    prisma.changeLog.findMany({
      where,
      include: {
        platform: true,
        content: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.changeLog.count({ where }),
  ]);

  return NextResponse.json({
    data: changes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
