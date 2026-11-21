import type { CSSProperties } from "react";
import { platformBackdropRgb } from "@/lib/platform-theme";

/**
 * Halo de fundo derivado da cor da marca da plataforma. Fica atrás do
 * conteúdo e não intercepta cliques; a intensidade é controlada por
 * variáveis CSS que acompanham o tema claro/escuro.
 */
export default function PlatformBackdrop({
  color,
}: {
  color?: string | null;
}) {
  const rgb = platformBackdropRgb(color);
  if (!rgb) return null;

  return (
    <div
      aria-hidden
      className="platform-backdrop pointer-events-none absolute inset-0 -z-10"
      style={{ "--platform-rgb": rgb } as CSSProperties}
    />
  );
}
