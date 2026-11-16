import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Public_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale } from "./dictionaries";
import ThemeProvider from "./ThemeProvider";
import { Analytics } from "@vercel/analytics/next";
import "../globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "StreamingDB", template: "%s | StreamingDB" },
  description: "Acompanhe preços, catálogos e mudanças das plataformas de streaming",
  keywords: ["streaming", "netflix", "prime video", "disney+", "preços", "catálogo"],
  openGraph: {
    title: "StreamingDB",
    description: "Acompanhe preços, catálogos e mudanças das plataformas de streaming",
    siteName: "StreamingDB",
    type: "website",
  },
};

export async function generateStaticParams() {
  return [{ lang: "en" }, { lang: "pt-BR" }];
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;

  if (!hasLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${newsreader.variable} ${publicSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
