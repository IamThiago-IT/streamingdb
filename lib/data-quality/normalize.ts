import { createHash } from "node:crypto";
import { GENRES, GENRE_ALIASES, LIMITS } from "./constants";

/** Remove acentos preservando o comprimento aproximado do texto. */
export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Texto comparável: minúsculo, sem acento, pontuação vira espaço. */
export function normalizeComparableText(value: string): string {
  return stripDiacritics(String(value ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Chave agressiva para nomes: só letras e números. */
export function normalizeNameKey(value: string): string {
  return stripDiacritics(String(value ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function slugify(value: string): string {
  return stripDiacritics(String(value ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const COUNTRY_ALIASES: Record<string, string> = {
  br: "BR",
  bra: "BR",
  brasil: "BR",
  brazil: "BR",
  us: "US",
  usa: "US",
  "united states": "US",
  "estados unidos": "US",
  ca: "CA",
  canada: "CA",
  gb: "GB",
  uk: "GB",
  "united kingdom": "GB",
  "reino unido": "GB",
  au: "AU",
  australia: "AU",
  mx: "MX",
  mexico: "MX",
  de: "DE",
  germany: "DE",
  alemanha: "DE",
  pt: "PT",
  portugal: "PT",
  es: "ES",
  spain: "ES",
  espanha: "ES",
  jp: "JP",
  japan: "JP",
  japao: "JP",
  in: "IN",
  india: "IN",
  kr: "KR",
  "south korea": "KR",
  "coreia do sul": "KR",
  korea: "KR",
};

/**
 * Normaliza códigos de país. Nomes e abreviações conhecidos são convertidos
 * para ISO 3166-1 alpha-2; o chamador decide se o código é suportado.
 */
export function normalizeCountryCode(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (COUNTRY_ALIASES[normalizeComparableText(raw)]) {
    return COUNTRY_ALIASES[normalizeComparableText(raw)];
  }
  return upper;
}

export function normalizeCurrency(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

export function isIsoCurrency(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

export function normalizeExternalSource(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "_");
}

/**
 * Valida e normaliza uma URL HTTP(S). Credenciais embutidas e protocolos
 * perigosos (javascript:, data:) são rejeitados.
 */
export function parseHttpUrl(value: unknown): URL | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (!url.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

/** Chave de site para detectar plataformas duplicadas por domínio. */
export function websiteKey(value: string | null | undefined): string | null {
  const url = parseHttpUrl(value);
  if (!url) return null;
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Converte datas para UTC de forma determinística.
 *
 * - `YYYY-MM-DD` vira meia-noite UTC (não meia-noite local).
 * - Timestamp sem fuso é interpretado como UTC.
 * - Timestamps com `Z` ou offset são respeitados.
 */
export function toUtcDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  const raw = String(value).trim();
  if (!raw) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (!isValidDateParts(year, month, day)) return null;
    return new Date(Date.UTC(year, month - 1, day));
  }

  const localIso =
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(raw);
  const normalized = localIso ? `${raw.replace(" ", "T")}Z` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isFutureDate(
  value: Date | null,
  now: Date = new Date(),
  toleranceMs = 5 * 60 * 1000
): boolean {
  return value !== null && value.getTime() > now.getTime() + toleranceMs;
}

export function toIsoString(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

/**
 * Converte valores monetários aceitando "1.234,56" e "1,234.56".
 * Retorna NaN quando o valor não é numérico.
 */
export function parseAmount(value: unknown): number {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "").trim().replace(/\s/g, "");
  if (!normalized) return Number.NaN;

  if (normalized.includes(",") && normalized.includes(".")) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    return Number(
      lastComma > lastDot
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "")
    );
  }

  return Number(normalized.replace(",", "."));
}

export type GenreNormalization = {
  genres: string[];
  unknown: string[];
};

/** Normaliza e ordena gêneros; devolve os desconhecidos para revisão. */
export function normalizeGenreList(value: unknown): GenreNormalization {
  const raw = String(value ?? "").trim();
  if (!raw) return { genres: [], unknown: [] };

  const canonical = new Map<string, string>(
    GENRES.map((genre) => [normalizeComparableText(genre), genre])
  );
  const genres = new Set<string>();
  const unknown: string[] = [];

  for (const part of raw.split(/[,;]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = normalizeComparableText(trimmed);
    const genre = canonical.get(key) ?? GENRE_ALIASES[key];
    if (genre) genres.add(genre);
    else unknown.push(trimmed);
  }

  return { genres: [...genres].sort((a, b) => a.localeCompare(b, "pt-BR")), unknown };
}

const SENSITIVE_KEY = /(password|senha|secret|token|authorization|cookie|api[_-]?key|credential)/i;

/**
 * Remove/trunca valores antes de gravar em log ou ChangeLog. Não substitui
 * dados do banco; é usado apenas em mensagens, metadados e auditoria.
 */
export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return value.length > LIMITS.issueMessage
      ? `${value.slice(0, LIMITS.issueMessage)}…`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= 4) return "[max-depth]";
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeForLog(item, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY.test(key)
        ? "[redacted]"
        : sanitizeForLog(item, depth + 1);
    }
    return output;
  }
  return String(value);
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Fingerprint estável para problemas de qualidade. */
export function fingerprint(rule: string, entityIds: string[]): string {
  return sha256Hex(`${rule}:${[...entityIds].sort().join("|")}`);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** Similaridade 0..1 baseada em distância de Levenshtein. */
export function textSimilarity(a: string, b: string): number {
  const left = normalizeComparableText(a);
  const right = normalizeComparableText(b);
  if (!left && !right) return 1;
  const max = Math.max(left.length, right.length);
  if (max === 0) return 1;
  return 1 - levenshtein(left, right) / max;
}

export function truncate(
  value: string,
  max: number = LIMITS.issueMessage
): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}
