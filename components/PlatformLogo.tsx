"use client";

import { useState } from "react";

type Platform = {
  name: string;
  logo?: string | null;
  color?: string | null;
};

type Size = "sm" | "md" | "lg";
type Status = "loading" | "loaded" | "failed";

const sizeMap: Record<Size, { container: string; image: number; text: string }> = {
  sm: { container: "w-6 h-6", image: 24, text: "text-[8px]" },
  md: { container: "w-8 h-8", image: 32, text: "text-[10px]" },
  lg: { container: "w-12 h-12", image: 48, text: "text-xs" },
};

export default function PlatformLogo({
  platform,
  size = "md",
  className = "",
}: {
  platform: Platform;
  size?: Size;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const logo = platform.logo;
  const s = sizeMap[size];

  // Imagens em cache podem terminar antes da hidratação; o ref resolve sem
  // depender do evento onLoad.
  function handleImgRef(img: HTMLImageElement | null) {
    if (img?.complete) {
      setStatus(img.naturalWidth > 0 ? "loaded" : "failed");
    }
  }

  const initial = platform.name.charAt(0).toUpperCase();
  const bg = platform.color ?? "#666";
  const showTile = !logo || status !== "loaded";

  return (
    <div
      className={`${s.container} relative flex-shrink-0 overflow-hidden rounded ${className}`}
      style={showTile ? { backgroundColor: bg } : undefined}
      title={platform.name}
    >
      {showTile && (
        <span
          className={`absolute inset-0 flex items-center justify-center font-bold text-white ${s.text}`}
        >
          {initial}
        </span>
      )}

      {logo && status !== "failed" && (
        <img
          ref={handleImgRef}
          src={logo}
          alt=""
          width={s.image}
          height={s.image}
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
          className={`absolute inset-0 h-full w-full rounded object-contain transition-opacity duration-150 ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
          referrerPolicy="origin"
        />
      )}
    </div>
  );
}
