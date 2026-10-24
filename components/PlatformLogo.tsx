import Image from "next/image";

type Platform = {
  name: string;
  logo?: string | null;
  color?: string | null;
};

type Size = "sm" | "md" | "lg";

const sizeMap: Record<Size, { container: string; image: number; fallback: string; text: string }> = {
  sm: { container: "w-6 h-6", image: 24, fallback: "w-1.5 h-1.5", text: "text-[8px]" },
  md: { container: "w-8 h-8", image: 32, fallback: "w-2.5 h-2.5", text: "text-[10px]" },
  lg: { container: "w-12 h-12", image: 48, fallback: "w-3.5 h-3.5", text: "text-xs" },
};

function isExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

export default function PlatformLogo({
  platform,
  size = "md",
  className = "",
}: {
  platform: Platform;
  size?: Size;
  className?: string;
}) {
  const s = sizeMap[size];

  if (platform.logo) {
    if (isExternalUrl(platform.logo)) {
      return (
        <div className={`${s.container} flex-shrink-0 rounded ${className}`}>
          <img
            src={platform.logo}
            alt={platform.name}
            width={s.image}
            height={s.image}
            className="w-full h-full object-contain rounded"
            referrerPolicy="origin"
          />
        </div>
      );
    }

    return (
      <div className={`${s.container} flex-shrink-0 rounded ${className}`}>
        <Image
          src={platform.logo}
          alt={platform.name}
          width={s.image}
          height={s.image}
          className="w-full h-full object-contain rounded"
        />
      </div>
    );
  }

  const initial = platform.name.charAt(0).toUpperCase();
  const bg = platform.color ?? "#666";

  return (
    <div
      className={`${s.container} flex-shrink-0 rounded flex items-center justify-center font-bold text-white ${s.text} ${className}`}
      style={{ backgroundColor: bg }}
      title={platform.name}
    >
      {initial}
    </div>
  );
}
