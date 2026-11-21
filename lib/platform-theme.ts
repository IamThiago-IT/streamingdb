type Rgb = [number, number, number];

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function parseHex(color: string): Rgb | null {
  const match = HEX_PATTERN.exec(color.trim());
  if (!match) return null;

  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function rgbToHsl([r, g, b]: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const delta = max - min;
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let h: number;
  switch (max) {
    case rn:
      h = (gn - bn) / delta + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / delta + 2;
      break;
    default:
      h = (rn - gn) / delta + 4;
  }

  return { h: h * 60, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let rgb: Rgb;
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  const m = l - c / 2;
  return [
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255),
  ];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Converte a cor da marca em canais RGB para o halo de fundo da página.
 *
 * A cor crua fica reservada ao logo. Para o fundo, a matiz é preservada mas
 * a luminosidade é presa a uma faixa média e a saturação é reduzida — assim
 * o halo continua remetendo à plataforma sem competir com o logo e sem
 * sumir em marcas muito escuras (Apple TV+, MUBI) ou muito claras.
 *
 * Retorna no formato "r g b", para uso em `rgb(var(--platform-rgb) / α)`.
 */
export function platformBackdropRgb(
  color: string | null | undefined
): string | null {
  if (!color) return null;

  const rgb = parseHex(color);
  if (!rgb) return null;

  const hsl = rgbToHsl(rgb);
  const themed = hslToRgb(
    hsl.h,
    hsl.s * 0.85,
    clamp(hsl.l, 0.36, 0.62)
  );

  return themed.join(" ");
}
