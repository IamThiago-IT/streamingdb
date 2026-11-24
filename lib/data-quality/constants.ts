/**
 * Constantes compartilhadas pela camada de qualidade.
 *
 * Os modelos Prisma usam String (não enums) para manter compatibilidade com
 * SQLite nos testes e com dados legados. Estes conjuntos são a fonte de
 * verdade para validação, relatórios e detecção de inconsistências.
 */

export const VERIFICATION_STATUSES = [
  "UNVERIFIED",
  "VERIFIED",
  "NEEDS_REVIEW",
  "REJECTED",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_STATUS = {
  UNVERIFIED: "UNVERIFIED",
  VERIFIED: "VERIFIED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  REJECTED: "REJECTED",
} as const satisfies Record<string, VerificationStatus>;

export const COLLECTION_METHODS = [
  "SEED",
  "CSV_IMPORT",
  "SCRAPER",
  "MANUAL",
  "API",
  "MIGRATION",
  "LEGACY",
] as const;
export type CollectionMethod = (typeof COLLECTION_METHODS)[number];

export const COLLECTION_METHOD = {
  SEED: "SEED",
  CSV_IMPORT: "CSV_IMPORT",
  SCRAPER: "SCRAPER",
  MANUAL: "MANUAL",
  API: "API",
  MIGRATION: "MIGRATION",
  LEGACY: "LEGACY",
} as const satisfies Record<string, CollectionMethod>;

/**
 * Origem declarada da informação. `sourceType` em PlanOffer já usava estes
 * valores; os demais modelos reutilizam o vocabulário para manter coerência.
 */
export const SOURCE_TYPES = [
  "SEED",
  "OFFICIAL_WEB",
  "HELP_CENTER",
  "IOS",
  "ANDROID",
  "MANUAL",
  "CSV_IMPORT",
  "LEGACY",
  "UNKNOWN",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const OFFER_STATUSES = ["ACTIVE", "STALE", "PENDING"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "ANNUAL"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const BILLING_CYCLE_MONTHS: Record<BillingCycle, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  ANNUAL: 12,
};

export const CONTENT_TYPES = ["MOVIE", "SERIES"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const PLATFORM_COUNTRY_STATUSES = [
  "OPERATES",
  "NOT_AVAILABLE",
  "UNKNOWN",
] as const;
export type PlatformCountryStatus =
  (typeof PLATFORM_COUNTRY_STATUSES)[number];

export const EXTERNAL_ID_SOURCES = ["TMDB", "IMDB", "TVDB", "WIKIDATA"] as const;
export type ExternalIdSource = (typeof EXTERNAL_ID_SOURCES)[number];

export const ENTITY_TYPES = [
  "PLATFORM",
  "PLAN",
  "PLAN_OFFER",
  "CONTENT",
  "CONTENT_AVAILABILITY",
  "PLATFORM_COUNTRY",
  "PRICE_SOURCE",
  "COLLECTION_RUN",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ISSUE_SEVERITIES = ["ERROR", "WARNING", "INFO"] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export const ISSUE_STATUSES = [
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
  "IGNORED",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const COLLECTION_KINDS = [
  "SCRAPE",
  "CSV_IMPORT",
  "REFRESH",
  "VERIFICATION",
  "CATALOG_SYNC",
] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

export const COLLECTION_STATUSES = [
  "RUNNING",
  "SUCCESS",
  "PARTIAL",
  "FAILED",
  "SKIPPED",
] as const;
export type CollectionStatus = (typeof COLLECTION_STATUSES)[number];

export const COLLECTION_ERROR_CODES = [
  "HTTP_ERROR",
  "TIMEOUT",
  "NETWORK_ERROR",
  "PARSE_EMPTY",
  "INVALID_DATA",
  "DUPLICATE_PLANS",
  "UNSUPPORTED_PARSER",
  "INTERNAL_ERROR",
] as const;
export type CollectionErrorCode = (typeof COLLECTION_ERROR_CODES)[number];

/**
 * Regras de detecção. O código é estável e usado no fingerprint do problema,
 * para que a mesma ocorrência não seja duplicada a cada varredura.
 */
export const ISSUE_RULES = {
  DUPLICATE_PLATFORM_NAME: "DUPLICATE_PLATFORM_NAME",
  DUPLICATE_PLATFORM_SLUG: "DUPLICATE_PLATFORM_SLUG",
  DUPLICATE_PLATFORM_WEBSITE: "DUPLICATE_PLATFORM_WEBSITE",
  DUPLICATE_CONTENT_EXTERNAL_ID: "DUPLICATE_CONTENT_EXTERNAL_ID",
  DUPLICATE_CONTENT_TITLE: "DUPLICATE_CONTENT_TITLE",
  CONFLICTING_CONTENT_EXTERNAL_ID: "CONFLICTING_CONTENT_EXTERNAL_ID",
  DUPLICATE_PLAN_TIER: "DUPLICATE_PLAN_TIER",
  DUPLICATE_OFFER: "DUPLICATE_OFFER",
  DUPLICATE_AVAILABILITY: "DUPLICATE_AVAILABILITY",
  COUNTRY_NOMENCLATURE: "COUNTRY_NOMENCLATURE",
  CURRENCY_COUNTRY_MISMATCH: "CURRENCY_COUNTRY_MISMATCH",
  AMOUNT_HISTORY_MISMATCH: "AMOUNT_HISTORY_MISMATCH",
  AVAILABILITY_INCONSISTENT: "AVAILABILITY_INCONSISTENT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  VALIDATION_WARNING: "VALIDATION_WARNING",
  STALE_DATA: "STALE_DATA",
  UNMAPPED_TMDB_PROVIDER: "UNMAPPED_TMDB_PROVIDER",
} as const;
export type IssueRule = (typeof ISSUE_RULES)[keyof typeof ISSUE_RULES];

/**
 * Políticas iniciais de re-verificação. São limites de atenção, não uma
 * garantia de que a coleta ocorreu. `NEVER_VERIFIED` nunca vence.
 */
export const FRESHNESS_POLICIES = [
  {
    key: "offer",
    entityType: "PLAN_OFFER",
    label: "Planos e ofertas",
    maxAgeHours: 24,
  },
  {
    key: "availability",
    entityType: "CONTENT_AVAILABILITY",
    label: "Disponibilidade de conteúdos",
    maxAgeHours: 72,
  },
  {
    key: "platform",
    entityType: "PLATFORM",
    label: "Características das plataformas",
    maxAgeHours: 168,
  },
  {
    key: "content",
    entityType: "CONTENT",
    label: "Metadados de filmes e séries",
    maxAgeHours: 720,
  },
  {
    key: "platform-country",
    entityType: "PLATFORM_COUNTRY",
    label: "Disponibilidade comercial por país",
    maxAgeHours: 168,
  },
] as const;

export type FreshnessPolicyKey = (typeof FRESHNESS_POLICIES)[number]["key"];

/**
 * Gêneros canônicos em português. Aliases em inglês/variações são
 * normalizados na entrada. Gêneros desconhecidos são rejeitados pela validação
 * (não inventamos um gênero para acomodar o dado).
 */
export const GENRES = [
  "Ação",
  "Animação",
  "Aventura",
  "Biografia",
  "Comédia",
  "Crime",
  "Documentário",
  "Drama",
  "Esporte",
  "Família",
  "Fantasia",
  "Faroeste",
  "Ficção Científica",
  "Guerra",
  "História",
  "Infantil",
  "Mistério",
  "Música",
  "Novela",
  "Reality Show",
  "Romance",
  "Sitcom",
  "Suspense",
  "Terror",
] as const;
export type Genre = (typeof GENRES)[number];

/** Alias normalizado (sem acento, minúsculo) → gênero canônico. */
export const GENRE_ALIASES: Record<string, Genre> = {
  acao: "Ação",
  action: "Ação",
  animacao: "Animação",
  animation: "Animação",
  anime: "Animação",
  aventura: "Aventura",
  adventure: "Aventura",
  biografia: "Biografia",
  biography: "Biografia",
  comedia: "Comédia",
  comedy: "Comédia",
  crime: "Crime",
  criminal: "Crime",
  documentario: "Documentário",
  documentary: "Documentário",
  drama: "Drama",
  esporte: "Esporte",
  sport: "Esporte",
  sports: "Esporte",
  familia: "Família",
  family: "Família",
  fantasia: "Fantasia",
  fantasy: "Fantasia",
  faroeste: "Faroeste",
  western: "Faroeste",
  "ficcao cientifica": "Ficção Científica",
  "science fiction": "Ficção Científica",
  "sci fi": "Ficção Científica",
  scifi: "Ficção Científica",
  guerra: "Guerra",
  war: "Guerra",
  historia: "História",
  history: "História",
  infantil: "Infantil",
  kids: "Infantil",
  misterio: "Mistério",
  mystery: "Mistério",
  musica: "Música",
  music: "Música",
  musical: "Música",
  novela: "Novela",
  "reality show": "Reality Show",
  reality: "Reality Show",
  romance: "Romance",
  sitcom: "Sitcom",
  suspense: "Suspense",
  thriller: "Suspense",
  terror: "Terror",
  horror: "Terror",
};

/** Limites plausíveis usados na validação. */
export const LIMITS = {
  platformName: 120,
  platformSlug: 120,
  contentTitle: 300,
  synopsis: 5000,
  displayName: 200,
  quality: 80,
  source: 200,
  sourceUrl: 2048,
  externalId: 120,
  maxAmount: 1_000_000,
  minYear: 1888,
  maxRating: 10,
  issueMessage: 500,
} as const;

/** Tolerância para considerar dois valores monetários iguais. */
export const MONEY_EPSILON = 0.005;
