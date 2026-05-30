import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const platformsData = [
  { name: "Looke", slug: "looke", color: "#6B3FA0", website: "https://looke.com.br" },
  { name: "Prime Video", slug: "prime-video", color: "#00A8E1", website: "https://primevideo.com" },
  { name: "Crunchyroll", slug: "crunchyroll", color: "#F47521", website: "https://crunchyroll.com" },
  { name: "Netflix", slug: "netflix", color: "#E50914", website: "https://netflix.com" },
  { name: "Globoplay", slug: "globoplay", color: "#D61E2C", website: "https://globoplay.globo.com" },
  { name: "YouTube Premium", slug: "youtube-premium", color: "#FF0000", website: "https://youtube.com/premium" },
  { name: "Disney+", slug: "disney-plus", color: "#113CCF", website: "https://disneyplus.com" },
  { name: "HBO Max", slug: "hbo-max", color: "#5822B4", website: "https://hbomax.com" },
  { name: "Apple TV+", slug: "apple-tv-plus", color: "#000000", website: "https://tv.apple.com" },
  { name: "Paramount+", slug: "paramount-plus", color: "#0064FF", website: "https://paramountplus.com" },
  { name: "MUBI", slug: "mubi", color: "#1C1C1C", website: "https://mubi.com" },
];

const plansData: Record<string, { name: string; price: number; quality?: string; ads: boolean; billingCycle?: string }[]> = {
  "looke": [
    { name: "Plano Mensal", price: 16.90, quality: "HD", ads: false },
  ],
  "prime-video": [
    { name: "Plano Mensal", price: 19.90, quality: "4K HDR", ads: false },
  ],
  "crunchyroll": [
    { name: "Plano FAN", price: 19.90, quality: "HD", ads: false },
    { name: "Plano Mega Fan", price: 29.90, quality: "HD", ads: false },
    { name: "Plano Ultimate Fan", price: 44.90, quality: "4K HDR", ads: false },
  ],
  "netflix": [
    { name: "Padrão com Anúncios", price: 20.90, quality: "HD", ads: true },
    { name: "Padrão", price: 44.90, quality: "HD", ads: false },
    { name: "Premium", price: 59.90, quality: "4K HDR", ads: false },
  ],
  "globoplay": [
    { name: "Padrão com Anúncios", price: 22.90, quality: "HD", ads: true },
    { name: "Globoplay + Canais", price: 34.90, quality: "HD", ads: false },
    { name: "Globoplay + Canais + Telecine", price: 57.90, quality: "HD", ads: false },
  ],
  "youtube-premium": [
    { name: "Plano Individual", price: 26.90, quality: "4K", ads: false },
    { name: "Plano Familiar", price: 44.90, quality: "4K", ads: false },
  ],
  "disney-plus": [
    { name: "Padrão com Anúncios", price: 27.99, quality: "HD", ads: true },
    { name: "Padrão", price: 43.99, quality: "HD", ads: false },
    { name: "Premium", price: 62.99, quality: "4K HDR", ads: false },
  ],
  "hbo-max": [
    { name: "Básico com Anúncios", price: 29.90, quality: "HD", ads: true },
    { name: "Standard", price: 39.90, quality: "HD", ads: false },
    { name: "Platimum", price: 49.90, quality: "4K HDR", ads: false },
  ],
  "apple-tv-plus": [
    { name: "Plano Mensal", price: 29.90, quality: "4K HDR", ads: false },
  ],
  "paramount-plus": [
    { name: "Plano Padrão", price: 34.90, quality: "HD", ads: false },
  ],
  "mubi": [
    { name: "Plano Mensal", price: 34.90, quality: "HD", ads: false },
    { name: "Plano Anual", price: 289.90, quality: "HD", ads: false, billingCycle: "anual" },
  ],
};

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

async function slugify(text: string): Promise<string> {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  for (const p of platformsData) {
    const platform = await prisma.platform.create({ data: p });

    const planEntries = plansData[p.slug];
    if (planEntries) {
      for (const planData of planEntries) {
        const plan = await prisma.plan.create({
          data: {
            platformId: platform.id,
            name: planData.name,
            price: planData.price,
            quality: planData.quality,
            ads: planData.ads,
            billingCycle: planData.billingCycle ?? "mensal",
          },
        });

        await prisma.priceHistory.create({
          data: { planId: plan.id, price: planData.price },
        });
      }
    }
  }

  for (const c of sampleContent) {
    const content = await prisma.content.create({
      data: {
        title: c.title,
        originalTitle: c.originalTitle,
        slug: await slugify(c.title),
        type: c.type,
        year: c.year,
        genre: c.genre,
        rating: c.rating,
      },
    });

    const allPlatforms = await prisma.platform.findMany({ take: 8 });
    const shuffled = allPlatforms.sort(() => Math.random() - 0.5).slice(0, 3);
    for (const platform of shuffled) {
      await prisma.contentAvailability.create({
        data: { contentId: content.id, platformId: platform.id },
      });
    }
  }

  const allPlatforms = await prisma.platform.findMany();
  for (const platform of allPlatforms) {
    await prisma.changeLog.create({
      data: {
        type: "NEW_PLATFORM",
        description: `${platform.name} foi adicionada ao catálogo`,
        platformId: platform.id,
      },
    });
  }

  const contents = await prisma.content.findMany({ take: 5 });
  for (const content of contents) {
    const platform = allPlatforms[Math.floor(Math.random() * allPlatforms.length)];
    await prisma.changeLog.create({
      data: {
        type: "CONTENT_ADDED",
        description: `${content.title} foi adicionado à ${platform.name}`,
        platformId: platform.id,
        contentId: content.id,
      },
    });
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
