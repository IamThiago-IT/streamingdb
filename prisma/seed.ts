import "dotenv/config";
import { PrismaClient } from "@/app/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/db-adapter";
import { countries } from "@/lib/countries";
import {
  COLLECTION_METHOD,
  VERIFICATION_STATUS,
} from "@/lib/data-quality/constants";
import { applyOffer } from "@/lib/data-quality/ingest";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const bf = (domain: string) =>
  `https://cdn.brandfetch.io/domain/${domain}/w/128/h/128/icon?c=1bxid64Mup7aczewSAYMX`;

const platformsData = [
  { name: "Looke", slug: "looke", color: "#0029C6", logo: bf("looke.com.br"), website: "https://looke.com.br" },
  { name: "Prime Video", slug: "prime-video", color: "#00A8E1", logo: bf("primevideo.com"), website: "https://primevideo.com" },
  { name: "Crunchyroll", slug: "crunchyroll", color: "#F47521", logo: bf("crunchyroll.com"), website: "https://crunchyroll.com" },
  { name: "Netflix", slug: "netflix", color: "#E50914", logo: bf("netflix.com"), website: "https://netflix.com" },
  { name: "Globoplay", slug: "globoplay", color: "#D61E2C", logo: bf("globoplay.globo.com"), website: "https://globoplay.globo.com" },
  { name: "YouTube Premium", slug: "youtube-premium", color: "#FF0000", logo: bf("youtube.com"), website: "https://youtube.com/premium" },
  { name: "Disney+", slug: "disney-plus", color: "#113CCF", logo: bf("disneyplus.com"), website: "https://disneyplus.com" },
  { name: "HBO Max", slug: "hbo-max", color: "#5822B4", logo: bf("max.com"), website: "https://max.com" },
  { name: "Apple TV+", slug: "apple-tv-plus", color: "#000000", logo: bf("tv.apple.com"), website: "https://tv.apple.com" },
  { name: "Paramount+", slug: "paramount-plus", color: "#0064FF", logo: bf("paramountplus.com"), website: "https://paramountplus.com" },
  { name: "MUBI", slug: "mubi", color: "#1C1C1C", logo: bf("mubi.com"), website: "https://mubi.com" },
];

type BillingCycle = "MONTHLY" | "ANNUAL";

type PlanSeed = {
  name: string;
  tierKey: string;
  price: number;
  quality?: string;
  ads: boolean;
  billingCycle?: BillingCycle;
};

const plansData: Record<string, PlanSeed[]> = {
  "looke": [
    { name: "Plano Mensal", tierKey: "mensal", price: 16.90, quality: "HD", ads: false },
  ],
  "prime-video": [
    { name: "Plano Mensal", tierKey: "mensal", price: 19.90, quality: "4K HDR", ads: false },
  ],
  "crunchyroll": [
    { name: "Plano FAN", tierKey: "fan", price: 19.90, quality: "HD", ads: false },
    { name: "Plano Mega Fan", tierKey: "mega-fan", price: 29.90, quality: "HD", ads: false },
    { name: "Plano Ultimate Fan", tierKey: "ultimate-fan", price: 44.90, quality: "4K HDR", ads: false },
  ],
  "netflix": [
    { name: "Padrão com Anúncios", tierKey: "com-anuncios", price: 25.90, quality: "HD", ads: true },
    { name: "Padrão", tierKey: "padrao", price: 51.90, quality: "HD", ads: false },
    { name: "Premium", tierKey: "premium", price: 71.90, quality: "4K HDR", ads: false },
  ],
  "globoplay": [
    { name: "Padrão com Anúncios", tierKey: "com-anuncios", price: 22.90, quality: "HD", ads: true },
    { name: "Globoplay + Canais", tierKey: "canais", price: 34.90, quality: "HD", ads: false },
    { name: "Globoplay + Canais + Telecine", tierKey: "canais-telecine", price: 57.90, quality: "HD", ads: false },
  ],
  "youtube-premium": [
    { name: "Plano Individual", tierKey: "individual", price: 26.90, quality: "4K", ads: false },
    { name: "Plano Familiar", tierKey: "familiar", price: 53.90, quality: "4K", ads: false },
  ],
  "disney-plus": [
    { name: "Padrão com Anúncios", tierKey: "com-anuncios", price: 29.90, quality: "HD", ads: true },
    { name: "Padrão", tierKey: "padrao", price: 49.90, quality: "HD", ads: false },
    { name: "Premium", tierKey: "premium", price: 69.90, quality: "4K HDR", ads: false },
  ],
  "hbo-max": [
    { name: "Básico com Anúncios", tierKey: "basico-com-anuncios", price: 29.90, quality: "HD", ads: true },
    { name: "Standard", tierKey: "standard", price: 39.90, quality: "HD", ads: false },
    { name: "Platimum", tierKey: "platinum", price: 49.90, quality: "4K HDR", ads: false },
  ],
  "apple-tv-plus": [
    { name: "Plano Mensal", tierKey: "mensal", price: 34.90, quality: "4K HDR", ads: false },
  ],
  "paramount-plus": [
    { name: "Plano Padrão", tierKey: "padrao", price: 34.90, quality: "HD", ads: false },
  ],
  "mubi": [
    { name: "Plano Mensal", tierKey: "mensal", price: 34.90, quality: "HD", ads: false },
    { name: "Plano Anual", tierKey: "anual", price: 289.90, quality: "HD", ads: false, billingCycle: "ANNUAL" },
  ],
};

const brOnlyPlatforms = new Set(["looke", "globoplay"]);

const sampleContent = [
  { title: "Stranger Things", originalTitle: "Stranger Things", type: "SERIES", year: 2016, genre: "Ficção Científica, Terror", rating: 8.7 },
  { title: "The Boys", originalTitle: "The Boys", type: "SERIES", year: 2019, genre: "Ação, Comédia", rating: 8.7 },
  { title: "Round 6", originalTitle: "Squid Game", type: "SERIES", year: 2021, genre: "Drama, Suspense", rating: 8.0 },
  { title: "O Senhor dos Anéis", originalTitle: "The Lord of the Rings: The Fellowship of the Ring", type: "MOVIE", year: 2001, genre: "Fantasia, Aventura", rating: 8.8 },
  { title: "Interestelar", originalTitle: "Interstellar", type: "MOVIE", year: 2014, genre: "Ficção Científica, Drama", rating: 8.7 },
  { title: "Wandinha", originalTitle: "Wednesday", type: "SERIES", year: 2022, genre: "Comédia, Fantasia", rating: 8.1 },
  { title: "The Last of Us", originalTitle: "The Last of Us", type: "SERIES", year: 2023, genre: "Drama, Ação", rating: 8.8 },
  { title: "O Problema dos 3 Corpos", originalTitle: "3 Body Problem", type: "SERIES", year: 2024, genre: "Ficção Científica", rating: 7.9 },
  { title: "House of the Dragon", originalTitle: "House of the Dragon", type: "SERIES", year: 2022, genre: "Fantasia, Drama", rating: 8.4 },
  { title: "Ted Lasso", originalTitle: "Ted Lasso", type: "SERIES", year: 2020, genre: "Comédia, Drama", rating: 8.8 },
  { title: "O Poderoso Chefão", originalTitle: "The Godfather", type: "MOVIE", year: 1972, genre: "Crime, Drama", rating: 9.2 },
  { title: "Matrix", originalTitle: "The Matrix", type: "MOVIE", year: 1999, genre: "Ação, Ficção Científica", rating: 8.7 },
  { title: "Dark", originalTitle: "Dark", type: "SERIES", year: 2017, genre: "Suspense, Ficção Científica", rating: 8.7 },
  { title: "Bridgerton", originalTitle: "Bridgerton", type: "SERIES", year: 2020, genre: "Romance, Drama", rating: 7.4 },
  { title: "Arcane", originalTitle: "Arcane", type: "SERIES", year: 2021, genre: "Animação, Ação", rating: 9.0 },
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function seedPlatformCountries(platformId: string, slug: string) {
  for (const country of countries) {
    const status =
      country.code === "BR"
        ? "OPERATES"
        : brOnlyPlatforms.has(slug)
          ? "NOT_AVAILABLE"
          : "UNKNOWN";

    // O seed é o dado inicial: nunca sobrescreve uma linha já existente,
    // que pode ter sido verificada/alterada por uma coleta real.
    const existing = await prisma.platformCountry.findUnique({
      where: {
        platformId_countryCode: {
          platformId,
          countryCode: country.code,
        },
      },
    });
    if (existing) continue;

    await prisma.platformCountry.create({
      data: {
        platformId,
        countryCode: country.code,
        status,
        source: "SEED",
        collectedAt: new Date(),
        collectionMethod: COLLECTION_METHOD.SEED,
        verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
      },
    });
  }
}

async function seedPlan(
  platform: { id: string; name: string; website: string | null },
  planData: PlanSeed
) {
  const byTier = await prisma.plan.findFirst({
    where: { platformId: platform.id, tierKey: planData.tierKey },
  });

  // Bancos migrados do modelo antigo têm tierKey derivado do nome. Adota o
  // plano existente em vez de criar um tier duplicado.
  let plan =
    byTier ??
    (await prisma.plan.findFirst({
      where: { platformId: platform.id, name: planData.name },
    }));

  if (plan) {
    plan = await prisma.plan.update({
      where: { id: plan.id },
      data: {
        name: planData.name,
        ...(byTier ? {} : { tierKey: planData.tierKey }),
      },
    });
  } else {
    plan = await prisma.plan.create({
      data: {
        platformId: platform.id,
        tierKey: planData.tierKey,
        name: planData.name,
        source: "SEED",
        collectionMethod: COLLECTION_METHOD.SEED,
        collectedAt: new Date(),
        verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
      },
    });
  }

  const billingCycle = planData.billingCycle ?? "MONTHLY";
  const billingMonths = billingCycle === "ANNUAL" ? 12 : 1;

  // Passa pela mesma camada de ingestão do importador/scraper: o seed cria a
  // oferta inicial sem se declarar verificado e nunca sobrescreve um preço já
  // verificado por uma coleta real.
  await applyOffer(
    prisma,
    {
      planId: plan.id,
      countryCode: "BR",
      currency: "BRL",
      amount: planData.price,
      billingCycle,
      billingMonths,
      taxIncluded: true,
      displayName: planData.name,
      quality: planData.quality ?? null,
      ads: planData.ads,
      sourceType: "SEED",
      status: "ACTIVE",
      source: "SEED",
      sourceUrl: platform.website,
      collectionMethod: COLLECTION_METHOD.SEED,
      collectedAt: new Date(),
      verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
    },
    { process: "prisma/seed" }
  );
}

async function main() {
  for (const p of platformsData) {
    // Plataforma já existente pode ter sido corrigida/verificada por coleta
    // real; o seed não sobrescreve metadados consolidados.
    const existingPlatform = await prisma.platform.findUnique({
      where: { slug: p.slug },
    });
    const platform =
      existingPlatform ??
      (await prisma.platform.create({
        data: {
          ...p,
          source: "SEED",
          collectionMethod: COLLECTION_METHOD.SEED,
          collectedAt: new Date(),
          verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
        },
      }));

    await seedPlatformCountries(platform.id, p.slug);

    const planEntries = plansData[p.slug] ?? [];
    for (const planData of planEntries) {
      await seedPlan(platform, planData);
    }
  }

  const looke = await prisma.platform.findUnique({ where: { slug: "looke" } });
  if (looke) {
    await prisma.priceSource.upsert({
      where: {
        platformId_countryCode_url: {
          platformId: looke.id,
          countryCode: "BR",
          url: "https://www.looke.com.br/planos",
        },
      },
      update: { isActive: true },
      create: {
        platformId: looke.id,
        countryCode: "BR",
        url: "https://www.looke.com.br/planos",
        parserKey: "looke",
        renderMode: "HTTP",
      },
    });
  }

  const allPlatforms = await prisma.platform.findMany({
    orderBy: { slug: "asc" },
  });

  for (const [contentIndex, c] of sampleContent.entries()) {
    const slug = slugify(c.title);
    // Conteúdo existente pode ter sido enriquecido por fonte externa;
    // o seed só cria o registro inicial.
    const existingContent = await prisma.content.findUnique({
      where: { slug },
    });
    const content =
      existingContent ??
      (await prisma.content.create({
        data: {
          title: c.title,
          originalTitle: c.originalTitle,
          slug,
          type: c.type,
          year: c.year,
          genre: c.genre,
          rating: c.rating,
          source: "SEED",
          collectionMethod: COLLECTION_METHOD.SEED,
          collectedAt: new Date(),
          verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
        },
      }));

    // Distribuição determinística: reexecutar o seed não cria novas
    // disponibilidades nem novos logs.
    const assigned = [0, 1, 2].map(
      (offset) =>
        allPlatforms[(contentIndex * 3 + offset) % allPlatforms.length]
    );

    for (const platform of assigned) {
      // Só cria o vínculo inicial: uma disponibilidade removida por coleta
      // real não é reativada por uma reexecução do seed.
      const existingAvailability = await prisma.contentAvailability.findUnique({
        where: {
          contentId_platformId_countryCode: {
            contentId: content.id,
            platformId: platform.id,
            countryCode: "BR",
          },
        },
      });
      if (existingAvailability) continue;

      await prisma.contentAvailability.create({
        data: {
          contentId: content.id,
          platformId: platform.id,
          countryCode: "BR",
          available: true,
          source: "SEED",
          collectionMethod: COLLECTION_METHOD.SEED,
          collectedAt: new Date(),
          verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
        },
      });
    }
  }

  for (const platform of allPlatforms) {
    const existing = await prisma.changeLog.findFirst({
      where: { type: "NEW_PLATFORM", platformId: platform.id },
    });

    if (!existing) {
      await prisma.changeLog.create({
        data: {
          type: "NEW_PLATFORM",
          entityType: "PLATFORM",
          entityId: platform.id,
          description: `${platform.name} foi adicionada ao catálogo`,
          platformId: platform.id,
          source: "SEED",
          process: "prisma/seed",
        },
      });
    }
  }

  const contents = await prisma.content.findMany({
    take: 5,
    orderBy: { slug: "asc" },
  });
  for (const [index, content] of contents.entries()) {
    // Mesma distribuição determinística das disponibilidades: reexecutar o
    // seed não cria novos logs de conteúdo.
    const platform = allPlatforms[(index * 3) % allPlatforms.length];
    const existing = await prisma.changeLog.findFirst({
      where: {
        type: "CONTENT_ADDED",
        platformId: platform.id,
        contentId: content.id,
      },
    });

    if (!existing) {
      await prisma.changeLog.create({
        data: {
          type: "CONTENT_ADDED",
          entityType: "CONTENT",
          entityId: content.id,
          description: `${content.title} foi adicionado à ${platform.name}`,
          platformId: platform.id,
          contentId: content.id,
          source: "SEED",
          process: "prisma/seed",
        },
      });
    }
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
