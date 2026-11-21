import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O Dockerfile define NEXT_OUTPUT=standalone para gerar o servidor
  // autocontido em .next/standalone. Na Vercel a saída padrão é usada.
  ...(process.env.NEXT_OUTPUT === "standalone"
    ? { output: "standalone" as const }
    : {}),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.brandfetch.io",
      },
    ],
  },
};

export default nextConfig;
