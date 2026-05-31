import "dotenv/config";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const newContent = [
  { title: "Fallout", type: "SERIES", year: 2024, genre: "Ficção Científica, Ação", rating: 8.5, platforms: ["prime-video"] },
  { title: "Xógos: A Saga de Um Herói", originalTitle: "Shōgun", type: "SERIES", year: 2024, genre: "Drama, Histórico", rating: 9.0, platforms: ["disney-plus"] },
  { title: "Ruptura", originalTitle: "Severance", type: "SERIES", year: 2022, genre: "Suspense, Ficção Científica", rating: 8.7, platforms: ["apple-tv-plus"] },
  { title: "Pinguim", originalTitle: "The Penguin", type: "SERIES", year: 2024, genre: "Crime, Drama", rating: 8.6, platforms: ["hbo-max"] },
  { title: "Duna: Parte 2", originalTitle: "Dune: Part Two", type: "MOVIE", year: 2024, genre: "Ficção Científica, Aventura", rating: 8.6, platforms: ["hbo-max"] },
  { title: "Agatha Desde Sempre", originalTitle: "Agatha All Along", type: "SERIES", year: 2024, genre: "Fantasia, Comédia", rating: 7.2, platforms: ["disney-plus"] },
  { title: "The Bear", originalTitle: "The Bear", type: "SERIES", year: 2022, genre: "Comédia, Drama", rating: 8.6, platforms: ["disney-plus"] },
  { title: "Godzilla Minus One", originalTitle: "ゴジラ-1.0", type: "MOVIE", year: 2023, genre: "Ação, Ficção Científica", rating: 7.7, platforms: ["netflix"] },
  { title: "Pobres Criaturas", originalTitle: "Poor Things", type: "MOVIE", year: 2023, genre: "Comédia, Ficção Científica", rating: 8.1, platforms: ["disney-plus"] },
  { title: "Oppenheimer", originalTitle: "Oppenheimer", type: "MOVIE", year: 2023, genre: "Drama, Histórico", rating: 8.4, platforms: ["prime-video", "netflix"] },
  { title: "Blue Eye Samurai", originalTitle: "Blue Eye Samurai", type: "SERIES", year: 2023, genre: "Animação, Ação", rating: 8.7, platforms: ["netflix"] },
  { title: "One Piece (Live Action)", originalTitle: "One Piece", type: "SERIES", year: 2023, genre: "Aventura, Comédia", rating: 8.1, platforms: ["netflix"] },
  { title: "Todos Menos Você", originalTitle: "Anyone But You", type: "MOVIE", year: 2023, genre: "Romance, Comédia", rating: 6.4, platforms: ["netflix"] },
  { title: "Mr. & Mrs. Smith", originalTitle: "Mr. & Mrs. Smith", type: "SERIES", year: 2024, genre: "Ação, Comédia", rating: 7.4, platforms: ["prime-video"] },
  { title: "Cidade de Deus", originalTitle: "Cidade de Deus", type: "MOVIE", year: 2002, genre: "Crime, Drama", rating: 8.6, platforms: ["globoplay", "netflix"] },
];

async function slugify(text: string): Promise<string> {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("=== Seed Content ===\n");

  for (const item of newContent) {
    const existing = await prisma.content.findFirst({
      where: { title: item.title },
    });
    if (existing) {
      console.log(`  ↪ "${item.title}" already exists, skipping`);
      continue;
    }

    const content = await prisma.content.create({
      data: {
        title: item.title,
        originalTitle: item.originalTitle,
        slug: await slugify(item.title),
        type: item.type,
        year: item.year,
        genre: item.genre,
        rating: item.rating,
      },
    });

    for (const platformSlug of item.platforms) {
      const platform = await prisma.platform.findUnique({
        where: { slug: platformSlug },
      });
      if (!platform) {
        console.warn(`  Platform ${platformSlug} not found`);
        continue;
      }

      await prisma.contentAvailability.create({
        data: { contentId: content.id, platformId: platform.id },
      });

      await prisma.changeLog.create({
        data: {
          type: "CONTENT_ADDED",
          description: `${item.title} foi adicionado à ${platform.name}`,
          platformId: platform.id,
          contentId: content.id,
        },
      });

      console.log(`  ✓ "${item.title}" → ${platform.name}`);
    }
  }

  console.log(`\n  ${newContent.length} titles processed`);
  await prisma.$disconnect();
}

main().catch(console.error);
