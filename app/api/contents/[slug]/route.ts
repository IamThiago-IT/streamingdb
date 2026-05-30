import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const content = await prisma.content.findUnique({
    where: { slug },
    include: {
      availability: {
        include: { platform: true },
        orderBy: { addedAt: "desc" },
      },
      changeLog: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  return NextResponse.json(content);
}
