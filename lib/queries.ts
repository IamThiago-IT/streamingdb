import { prisma } from "./db";

export async function getPlatforms() {
  return prisma.platform.findMany({
    include: {
      plans: { orderBy: { price: "asc" } },
      _count: { select: { availability: { where: { available: true } } } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getPlatformBySlug(slug: string) {
  return prisma.platform.findUnique({
    where: { slug },
    include: {
      plans: {
        include: {
          priceHistory: { orderBy: { recordedAt: "desc" }, take: 20 },
        },
        orderBy: { price: "asc" },
      },
      availability: {
        where: { available: true },
        include: { content: true },
        orderBy: { addedAt: "desc" },
        take: 50,
      },
      changeLog: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { content: true },
      },
    },
  });
}

export async function getContents(params: {
  query?: string;
  type?: string;
  platform?: string;
  genre?: string;
  page?: number;
  limit?: number;
}) {
  const { query, type, platform, genre, page = 1, limit = 20 } = params;
  const where: Record<string, unknown> = {};

  if (query) {
    where.OR = [
      { title: { contains: query } },
      { originalTitle: { contains: query } },
    ];
  }
  if (type) where.type = type;
  if (genre) where.genre = { contains: genre };
  if (platform) {
    where.availability = { some: { platform: { slug: platform }, available: true } };
  }

  const [data, total] = await Promise.all([
    prisma.content.findMany({
      where,
      include: {
        availability: {
          where: { available: true },
          include: { platform: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.content.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getContentBySlug(slug: string) {
  return prisma.content.findUnique({
    where: { slug },
    include: {
      availability: {
        where: { available: true },
        include: { platform: true },
        orderBy: { addedAt: "desc" },
      },
      changeLog: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { platform: true },
      },
    },
  });
}

export async function getRecentChanges(limit = 30) {
  return prisma.changeLog.findMany({
    include: { platform: true, content: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getDashboardStats() {
  const [platformCount, contentCount, changeCount, cheapestPlan] = await Promise.all([
    prisma.platform.count(),
    prisma.content.count(),
    prisma.changeLog.count(),
    prisma.plan.findFirst({ orderBy: { price: "asc" }, include: { platform: true } }),
  ]);

  return { platformCount, contentCount, changeCount, cheapestPlan };
}
