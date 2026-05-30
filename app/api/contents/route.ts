import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const type = searchParams.get("type");
  const platform = searchParams.get("platform");
  const genre = searchParams.get("genre");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

  const where: Record<string, unknown> = {};

  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { originalTitle: { contains: query, mode: "insensitive" } },
    ];
  }

  if (type) where.type = type;
  if (genre) where.genre = { contains: genre, mode: "insensitive" };
  if (platform) {
    where.availability = {
      some: { platform: { slug: platform } },
    };
  }

  const [contents, total] = await Promise.all([
    prisma.content.findMany({
      where,
      include: {
        availability: {
          include: { platform: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.content.count({ where }),
  ]);

  return NextResponse.json({
    data: contents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
