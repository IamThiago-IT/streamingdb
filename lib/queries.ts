import { prisma } from "./db";
import { containsInsensitive } from "./db-filters";
import { monthlyAmount } from "./money";

const activeOfferStatuses = ["ACTIVE", "STALE"];

export async function getPlatforms(countryCode: string) {
  return prisma.platform.findMany({
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
}

/** Lista simples para filtros de catálogo (sem preço/país). */
export async function getPlatformList() {
  return prisma.platform.findMany({ orderBy: { name: "asc" } });
}

export async function getPlatformBySlug(slug: string, countryCode: string) {
  return prisma.platform.findUnique({
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
        orderBy: { name: "asc" },
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
        include: { content: true },
      },
    },
  });
}

export type PlatformWithPriceHistory = Awaited<
  ReturnType<typeof getPlatformWithAllPriceHistory>
>;

export async function getPlatformWithAllPriceHistory(
  slug: string,
  countryCode: string
) {
  return prisma.platform.findUnique({
    where: { slug },
    include: {
      plans: {
        include: {
          offers: {
            where: { countryCode },
            include: {
              history: { orderBy: { recordedAt: "asc" } },
            },
          },
        },
        orderBy: { name: "asc" },
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
      { title: containsInsensitive(query) },
      { originalTitle: containsInsensitive(query) },
    ];
  }
  if (type) where.type = type;
  if (genre) where.genre = containsInsensitive(genre);
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

export async function getRecentChanges(
  countryCode: string,
  type?: string,
  limit = 50
) {
  const where: Record<string, unknown> = {
    OR: [{ countryCode }, { countryCode: null }],
  };
  if (type) where.type = type;

  return prisma.changeLog.findMany({
    where,
    include: { platform: true, content: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getDashboardStats(countryCode: string) {
  const [platformCount, contentCount, changeCount, offers] = await Promise.all([
    prisma.platform.count(),
    prisma.content.count(),
    prisma.changeLog.count({
      where: { OR: [{ countryCode }, { countryCode: null }] },
    }),
    prisma.planOffer.findMany({
      where: {
        countryCode,
        status: { in: activeOfferStatuses },
      },
      include: { plan: { include: { platform: true } } },
    }),
  ]);

  const cheapestOffer =
    [...offers].sort(
      (a, b) =>
        monthlyAmount(a.amount, a.billingMonths) -
        monthlyAmount(b.amount, b.billingMonths)
    )[0] ?? null;

  return { platformCount, contentCount, changeCount, cheapestOffer };
}

export async function getPlanPricesAtDates(
  platformId: string,
  countryCode: string
) {
  const plans = await prisma.plan.findMany({
    where: { platformId },
    include: {
      offers: {
        where: { countryCode },
        include: {
          history: { orderBy: { recordedAt: "asc" } },
        },
      },
    },
  });

  const periods = [
    { key: "6m", months: 6 },
    { key: "1y", months: 12 },
    { key: "2y", months: 24 },
  ];

  return plans.flatMap((plan) =>
    plan.offers.map((offer) => {
      const now = new Date();
      const periodPrices: Record<
        string,
        { amount: number; date: Date } | null
      > = {};

      for (const period of periods) {
        const target = new Date(now);
        target.setMonth(target.getMonth() - period.months);

        let closest: { amount: number; date: Date } | null = null;
        for (const h of offer.history) {
          if (h.recordedAt <= target) {
            closest = { amount: Number(h.amount), date: h.recordedAt };
          } else {
            break;
          }
        }
        periodPrices[period.key] = closest;
      }

      const lowestRecord =
        offer.history.length > 0
          ? offer.history.reduce((min, h) =>
              Number(h.amount) < Number(min.amount) ? h : min
            )
          : null;

      return {
        offerId: offer.id,
        planId: plan.id,
        planName: offer.displayName ?? plan.name,
        currency: offer.currency,
        currentAmount: Number(offer.amount),
        periodPrices,
        lowestPrice: lowestRecord
          ? { amount: Number(lowestRecord.amount), date: lowestRecord.recordedAt }
          : null,
      };
    })
  );
}

export async function getPriceComparison(countryCode: string) {
  const offers = await prisma.planOffer.findMany({
    where: {
      countryCode,
      status: { in: activeOfferStatuses },
    },
    include: { plan: { include: { platform: true } } },
  });

  const sorted = [...offers].sort(
    (a, b) =>
      monthlyAmount(a.amount, a.billingMonths) -
      monthlyAmount(b.amount, b.billingMonths)
  );

  const adsPlans = sorted.filter((offer) => offer.ads);
  const noAdsPlans = sorted.filter((offer) => !offer.ads);

  return {
    cheapest: sorted.slice(0, 5),
    cheapestNoAds: noAdsPlans.slice(0, 5),
    cheapestWithAds: adsPlans.slice(0, 5),
  };
}
