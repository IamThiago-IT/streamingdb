import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { hasLocale } from "./dictionaries";
import ThemeProvider from "./ThemeProvider";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
