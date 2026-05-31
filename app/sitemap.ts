import { prisma } from "@/lib/db";

export default async function sitemap() {
  const baseUrl = "https://streamingdb.app";

  const [platforms, contents] = await Promise.all([
    prisma.platform.findMany({ select: { slug: true } }),
    prisma.content.findMany({ select: { slug: true } }),
  ]);

  const locales = ["en", "pt-BR"];

  const staticPages = locales.flatMap((locale) => [
    { url: `${baseUrl}/${locale}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 1 },
    { url: `${baseUrl}/${locale}/platforms`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${baseUrl}/${locale}/contents`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${baseUrl}/${locale}/changes`, lastModified: new Date(), changeFrequency: "hourly" as const, priority: 0.8 },
    { url: `${baseUrl}/${locale}/compare`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.7 },
  ]);

  const platformPages = platforms.flatMap((p) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}/platforms/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }))
  );

  const contentPages = contents.flatMap((c) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}/contents/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }))
  );

  return [...staticPages, ...platformPages, ...contentPages];
}
