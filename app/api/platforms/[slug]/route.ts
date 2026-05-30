import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const platform = await prisma.platform.findUnique({
    where: { slug },
    include: {
      plans: {
        include: {
          priceHistory: { orderBy: { recordedAt: "desc" }, take: 10 },
        },
      },
      availability: {
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

  return NextResponse.json(platform);
}
