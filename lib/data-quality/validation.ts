import { isCountry, getCountryCurrency } from "@/lib/countries";
import {
  BILLING_CYCLES,
  BILLING_CYCLE_MONTHS,
  COLLECTION_ERROR_CODES,
  COLLECTION_KINDS,
  COLLECTION_METHODS,
  COLLECTION_STATUSES,
  CONTENT_TYPES,
  EXTERNAL_ID_SOURCES,
  ISSUE_SEVERITIES,
  LIMITS,
  OFFER_STATUSES,
  PLATFORM_COUNTRY_STATUSES,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  type BillingCycle,
  type CollectionErrorCode,
  type CollectionKind,
  type CollectionMethod,
  type CollectionStatus,
  type ContentType,
  type EntityType,
  type OfferStatus,
  type PlatformCountryStatus,
  type SourceType,
  type VerificationStatus,
} from "./constants";
import {
  isFutureDate,
  isIsoCurrency,
  normalizeComparableText,
  normalizeCountryCode,
  normalizeCurrency,
  normalizeExternalSource,
  normalizeGenreList,
  normalizeNameKey,
  parseAmount,
  parseHttpUrl,
  slugify,
  toUtcDate,
} from "./normalize";

export type ValidationSeverity = "ERROR" | "WARNING";

export type ValidationIssue = {
  field: string;
  code: string;
  message: string;
  severity: ValidationSeverity;
};

export type ValidationResult<T> = {
  ok: boolean;
  value: T;
  issues: ValidationIssue[];
};

export class DataQualityValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(label: string, issues: ValidationIssue[]) {
    const errors = issues.filter((issue) => issue.severity === "ERROR");
    super(
      `${label}: ${errors.map((issue) => `${issue.field} (${issue.message})`).join("; ")}`
    );
    this.name = "DataQualityValidationError";
    this.issues = issues;
  }
}

function result<T>(value: T, issues: ValidationIssue[]): ValidationResult<T> {
  return {
    ok: !issues.some((issue) => issue.severity === "ERROR"),
    value,
    issues,
  };
}

function addIssue(
  issues: ValidationIssue[],
  field: string,
  code: string,
  message: string,
  severity: ValidationSeverity = "ERROR"
) {
  issues.push({ field, code, message, severity });
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asOptionalString(value: unknown, max: number): string | null {
  const text = asString(value);
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function asBoolean(
  value: unknown
): { value: boolean | null; invalid: boolean } {
  if (value === null || value === undefined || value === "") {
    return { value: null, invalid: false };
  }
  if (typeof value === "boolean") return { value, invalid: false };
  const normalized = asString(value).toLowerCase();
  if (["true", "1", "sim", "yes", "y"].includes(normalized)) {
    return { value: true, invalid: false };
  }
  if (["false", "0", "nao", "não", "no", "n"].includes(normalized)) {
    return { value: false, invalid: false };
  }
  return { value: null, invalid: true };
}

function inList<T extends readonly string[]>(
  value: string,
  list: T
): value is T[number] {
  return list.includes(value);
}

export type ProvenanceInput = {
  source?: unknown;
  sourceUrl?: unknown;
  collectionMethod?: unknown;
  collectedAt?: unknown;
  lastVerifiedAt?: unknown;
  verificationStatus?: unknown;
};

export type NormalizedProvenance = {
  source: string | null;
  sourceUrl: string | null;
  collectionMethod: CollectionMethod | null;
  collectedAt: Date | null;
  lastVerifiedAt: Date | null;
  verificationStatus: VerificationStatus;
};

/**
 * Valida proveniência. Falta de origem é um aviso (dado legado pode existir),
 * mas declarar VERIFIED sem data/fonte é erro: verificação não se presume.
 */
export function validateProvenance(
  input: ProvenanceInput,
  options: { now?: Date; requireSource?: boolean; fieldPrefix?: string } = {}
): ValidationResult<NormalizedProvenance> {
  const now = options.now ?? new Date();
  const prefix = options.fieldPrefix ?? "provenance";
  const issues: ValidationIssue[] = [];

  const source = asOptionalString(input.source, LIMITS.source);
  const collectionMethodRaw = asString(input.collectionMethod).toUpperCase();
  const collectionMethod = collectionMethodRaw
    ? (collectionMethodRaw as CollectionMethod)
    : null;
  if (collectionMethodRaw && !inList(collectionMethodRaw, COLLECTION_METHODS)) {
    addIssue(
      issues,
      `${prefix}.collectionMethod`,
      "INVALID_COLLECTION_METHOD",
      `método de coleta inválido: ${collectionMethodRaw}`
    );
  }

  const sourceUrlRaw = asString(input.sourceUrl);
  const sourceUrl = sourceUrlRaw || null;
  if (sourceUrl && !parseHttpUrl(sourceUrl)) {
    addIssue(
      issues,
      `${prefix}.sourceUrl`,
      "INVALID_SOURCE_URL",
      "sourceUrl precisa ser uma URL HTTP(S) válida, sem credenciais"
    );
  }

  const collectedAt = toUtcDate(input.collectedAt);
  if (input.collectedAt && !collectedAt) {
    addIssue(
      issues,
      `${prefix}.collectedAt`,
      "INVALID_COLLECTED_AT",
      "collectedAt inválido"
    );
  }
  if (isFutureDate(collectedAt, now)) {
    addIssue(
      issues,
      `${prefix}.collectedAt`,
      "FUTURE_COLLECTED_AT",
      "collectedAt está no futuro"
    );
  }

  const lastVerifiedAt = toUtcDate(input.lastVerifiedAt);
  if (input.lastVerifiedAt && !lastVerifiedAt) {
    addIssue(
      issues,
      `${prefix}.lastVerifiedAt`,
      "INVALID_LAST_VERIFIED_AT",
      "lastVerifiedAt inválido"
    );
  }
  if (isFutureDate(lastVerifiedAt, now)) {
    addIssue(
      issues,
      `${prefix}.lastVerifiedAt`,
      "FUTURE_LAST_VERIFIED_AT",
      "lastVerifiedAt está no futuro"
    );
  }

  const statusRaw = asString(input.verificationStatus).toUpperCase();
  const verificationStatus = (statusRaw ||
    "UNVERIFIED") as VerificationStatus;
  if (!inList(verificationStatus, VERIFICATION_STATUSES)) {
    addIssue(
      issues,
      `${prefix}.verificationStatus`,
      "INVALID_VERIFICATION_STATUS",
      `status de verificação inválido: ${verificationStatus}`
    );
  }

  if (verificationStatus === "VERIFIED") {
    if (!lastVerifiedAt) {
      addIssue(
        issues,
        `${prefix}.lastVerifiedAt`,
        "VERIFIED_WITHOUT_DATE",
        "um registro VERIFIED exige lastVerifiedAt"
      );
    }
    if (!source) {
      addIssue(
        issues,
        `${prefix}.source`,
        "VERIFIED_WITHOUT_SOURCE",
        "um registro VERIFIED exige source identificável"
      );
    }
    if (source && ["SEED", "LEGACY", "UNKNOWN"].includes(source.toUpperCase())) {
      addIssue(
        issues,
        `${prefix}.source`,
        "INVALID_VERIFIED_SOURCE",
        `a origem ${source} não pode ser tratada como verificação`
      );
    }
    if (
      !sourceUrl &&
      !["SCRAPER", "CSV_IMPORT", "API"].includes(collectionMethod ?? "")
    ) {
      addIssue(
        issues,
        `${prefix}.sourceUrl`,
        "VERIFIED_WITHOUT_URL",
        "um registro VERIFIED exige sourceUrl ou um método de coleta rastreável"
      );
    }
  }

  if (options.requireSource && !source) {
    addIssue(
      issues,
      `${prefix}.source`,
      "MISSING_SOURCE",
      "source é obrigatório para novos registros"
    );
  }
  if (options.requireSource && !collectionMethod) {
    addIssue(
      issues,
      `${prefix}.collectionMethod`,
      "MISSING_COLLECTION_METHOD",
      "collectionMethod é obrigatório para novos registros"
    );
  }
  if (!source) {
    addIssue(
      issues,
      `${prefix}.source`,
      "UNKNOWN_PROVENANCE",
      "registro sem origem identificável",
      "WARNING"
    );
  }
  if (!collectionMethod) {
    addIssue(
      issues,
      `${prefix}.collectionMethod`,
      "UNKNOWN_COLLECTION_METHOD",
      "método de coleta desconhecido",
      "WARNING"
    );
  }

  return result(
    {
      source,
      sourceUrl,
      collectionMethod,
      collectedAt: collectedAt ?? null,
      lastVerifiedAt: lastVerifiedAt ?? null,
      verificationStatus,
    },
    issues
  );
}

export type PlatformInput = ProvenanceInput & {
  name?: unknown;
  slug?: unknown;
  logo?: unknown;
  website?: unknown;
  color?: unknown;
  countryCodes?: unknown[];
};

export type NormalizedPlatform = {
  name: string;
  slug: string;
  logo: string | null;
  website: string | null;
  color: string | null;
  countryCodes: string[];
  provenance: NormalizedProvenance;
};

export function validatePlatformInput(
  input: PlatformInput,
  options: { now?: Date; requireProvenance?: boolean } = {}
): ValidationResult<NormalizedPlatform> {
  const issues: ValidationIssue[] = [];
  const name = asString(input.name);
  if (!name) {
    addIssue(issues, "name", "REQUIRED", "nome é obrigatório");
  } else if (name.length > LIMITS.platformName) {
    addIssue(
      issues,
      "name",
      "TOO_LONG",
      `nome excede ${LIMITS.platformName} caracteres`
    );
  }

  const slugRaw = asString(input.slug);
  const slug = slugRaw ? slugify(slugRaw) : slugify(name);
  if (!slug) {
    addIssue(issues, "slug", "REQUIRED", "slug é obrigatório e derivável do nome");
  } else if (slug.length > LIMITS.platformSlug) {
    addIssue(
      issues,
      "slug",
      "TOO_LONG",
      `slug excede ${LIMITS.platformSlug} caracteres`
    );
  } else if (slug !== slugRaw && slugRaw) {
    addIssue(
      issues,
      "slug",
      "INVALID_SLUG",
      "slug deve conter apenas letras minúsculas, números e hífens"
    );
  }

  const websiteRaw = asString(input.website);
  if (websiteRaw && !parseHttpUrl(websiteRaw)) {
    addIssue(
      issues,
      "website",
      "INVALID_URL",
      "website precisa ser uma URL HTTP(S) válida"
    );
  }
  const logoRaw = asString(input.logo);
  if (logoRaw && !parseHttpUrl(logoRaw)) {
    addIssue(
      issues,
      "logo",
      "INVALID_URL",
      "logo precisa ser uma URL HTTP(S) válida"
    );
  }

  const colorRaw = asString(input.color);
  if (colorRaw && !/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(colorRaw)) {
    addIssue(issues, "color", "INVALID_COLOR", "color deve ser hexadecimal (#RGB ou #RRGGBB)");
  }

  const countryCodes: string[] = [];
  if (input.countryCodes !== undefined) {
    if (!Array.isArray(input.countryCodes)) {
      addIssue(issues, "countryCodes", "INVALID_TYPE", "countryCodes deve ser uma lista");
    } else {
      for (const raw of input.countryCodes) {
        const code = normalizeCountryCode(raw);
        if (!isCountry(code)) {
          addIssue(
            issues,
            "countryCodes",
            "UNSUPPORTED_COUNTRY",
            `país não suportado: ${String(raw)}`
          );
          continue;
        }
        if (countryCodes.includes(code)) {
          addIssue(
            issues,
            "countryCodes",
            "DUPLICATE_COUNTRY",
            `país repetido: ${code}`,
            "WARNING"
          );
        } else {
          countryCodes.push(code);
        }
      }
    }
  }

  const provenance = validateProvenance(input, {
    now: options.now,
    requireSource: options.requireProvenance ?? true,
  });
  issues.push(...provenance.issues.map((issue) => ({ ...issue, field: `provenance.${issue.field}` })));

  return result(
    {
      name,
      slug,
      logo: logoRaw || null,
      website: websiteRaw || null,
      color: colorRaw || null,
      countryCodes,
      provenance: provenance.value,
    },
    issues
  );
}

export type PlanInput = ProvenanceInput & {
  platformId?: unknown;
  tierKey?: unknown;
  name?: unknown;
};

export type NormalizedPlan = {
  platformId: string;
  tierKey: string | null;
  name: string;
  provenance: NormalizedProvenance;
};

export function validatePlanInput(
  input: PlanInput,
  options: { now?: Date; requireProvenance?: boolean } = {}
): ValidationResult<NormalizedPlan> {
  const issues: ValidationIssue[] = [];
  const platformId = asString(input.platformId);
  if (!platformId) {
    addIssue(issues, "platformId", "REQUIRED", "plataforma é obrigatória");
  }
  const name = asString(input.name);
  if (!name) {
    addIssue(issues, "name", "REQUIRED", "nome do plano é obrigatório");
  } else if (name.length > LIMITS.platformName) {
    addIssue(
      issues,
      "name",
      "TOO_LONG",
      `nome do plano excede ${LIMITS.platformName} caracteres`
    );
  }
  const tierRaw = asString(input.tierKey);
  const tierKey = tierRaw ? slugify(tierRaw) : null;
  if (!tierKey) {
    addIssue(
      issues,
      "tierKey",
      "MISSING_TIER_KEY",
      "tierKey ausente; o plano não pode ser reencontrado entre países",
      "WARNING"
    );
  } else if (tierRaw && tierKey !== tierRaw) {
    addIssue(
      issues,
      "tierKey",
      "INVALID_TIER_KEY",
      "tierKey deve conter apenas letras minúsculas, números e hífens"
    );
  }

  const provenance = validateProvenance(input, {
    now: options.now,
    requireSource: options.requireProvenance ?? true,
  });
  issues.push(...provenance.issues.map((issue) => ({ ...issue, field: `provenance.${issue.field}` })));

  return result(
    { platformId, tierKey, name, provenance: provenance.value },
    issues
  );
}

export type ContentInput = ProvenanceInput & {
  title?: unknown;
  originalTitle?: unknown;
  slug?: unknown;
  externalId?: unknown;
  externalSource?: unknown;
  type?: unknown;
  year?: unknown;
  genre?: unknown;
  poster?: unknown;
  synopsis?: unknown;
  rating?: unknown;
};

export type NormalizedContent = {
  title: string;
  originalTitle: string | null;
  slug: string;
  externalId: string | null;
  externalSource: string | null;
  type: ContentType | null;
  year: number | null;
  genre: string | null;
  poster: string | null;
  synopsis: string | null;
  rating: number | null;
  provenance: NormalizedProvenance;
};

export function validateContentInput(
  input: ContentInput,
  options: { now?: Date; requireProvenance?: boolean } = {}
): ValidationResult<NormalizedContent> {
  const now = options.now ?? new Date();
  const issues: ValidationIssue[] = [];

  const title = asString(input.title);
  if (!title) {
    addIssue(issues, "title", "REQUIRED", "título é obrigatório");
  } else if (title.length > LIMITS.contentTitle) {
    addIssue(
      issues,
      "title",
      "TOO_LONG",
      `título excede ${LIMITS.contentTitle} caracteres`
    );
  }
  const originalTitle = asOptionalString(input.originalTitle, LIMITS.contentTitle);

  const slugRaw = asString(input.slug);
  const slug = slugRaw ? slugify(slugRaw) : slugify(title);
  if (!slug) {
    addIssue(issues, "slug", "REQUIRED", "slug é obrigatório e derivável do título");
  } else if (slugRaw && slug !== slugRaw) {
    addIssue(
      issues,
      "slug",
      "INVALID_SLUG",
      "slug deve conter apenas letras minúsculas, números e hífens"
    );
  }

  const typeRaw = asString(input.type).toUpperCase();
  const type = typeRaw ? (typeRaw as ContentType) : null;
  if (!type || !inList(type, CONTENT_TYPES)) {
    addIssue(
      issues,
      "type",
      "INVALID_TYPE",
      `tipo de conteúdo inválido: ${typeRaw || "(vazio)"}; use MOVIE ou SERIES`
    );
  }

  let year: number | null = null;
  if (input.year !== null && input.year !== undefined && input.year !== "") {
    const parsed = Number(input.year);
    if (!Number.isInteger(parsed)) {
      addIssue(issues, "year", "INVALID_YEAR", "ano deve ser inteiro");
    } else if (parsed < LIMITS.minYear || parsed > now.getUTCFullYear() + 2) {
      addIssue(
        issues,
        "year",
        "IMPLAUSIBLE_YEAR",
        `ano fora do intervalo plausível (${LIMITS.minYear}–${now.getUTCFullYear() + 2})`
      );
    } else {
      year = parsed;
    }
  }

  const genreRaw = asString(input.genre);
  const normalizedGenres = normalizeGenreList(genreRaw);
  if (normalizedGenres.unknown.length > 0) {
    addIssue(
      issues,
      "genre",
      "UNKNOWN_GENRE",
      `gênero(s) desconhecido(s): ${normalizedGenres.unknown.join(", ")}`
    );
  }
  const genre = normalizedGenres.genres.length > 0
    ? normalizedGenres.genres.join(", ")
    : null;

  const rating =
    input.rating === null || input.rating === undefined || input.rating === ""
      ? null
      : Number(input.rating);
  if (
    rating !== null &&
    (!Number.isFinite(rating) || rating < 0 || rating > LIMITS.maxRating)
  ) {
    addIssue(
      issues,
      "rating",
      "INVALID_RATING",
      `avaliação deve estar entre 0 e ${LIMITS.maxRating}`
    );
  }

  const posterRaw = asString(input.poster);
  if (posterRaw && !parseHttpUrl(posterRaw)) {
    addIssue(issues, "poster", "INVALID_URL", "poster precisa ser uma URL HTTP(S) válida");
  }
  const synopsis = asOptionalString(input.synopsis, LIMITS.synopsis);

  const externalId = asOptionalString(input.externalId, LIMITS.externalId);
  const externalSource = normalizeExternalSource(input.externalSource) || null;
  if (externalId && !externalSource) {
    addIssue(
      issues,
      "externalSource",
      "MISSING_EXTERNAL_SOURCE",
      "externalId exige externalSource"
    );
  }
  if (externalSource && !externalId) {
    addIssue(
      issues,
      "externalId",
      "MISSING_EXTERNAL_ID",
      "externalSource exige externalId"
    );
  }
  if (
    externalSource &&
    !inList(externalSource, EXTERNAL_ID_SOURCES)
  ) {
    addIssue(
      issues,
      "externalSource",
      "UNKNOWN_EXTERNAL_SOURCE",
      `fonte de identificador externo desconhecida: ${externalSource}`
    );
  }

  const provenance = validateProvenance(input, {
    now,
    requireSource: options.requireProvenance ?? true,
  });
  issues.push(...provenance.issues.map((issue) => ({ ...issue, field: `provenance.${issue.field}` })));

  return result(
    {
      title,
      originalTitle,
      slug,
      externalId,
      externalSource,
      type: type && inList(type, CONTENT_TYPES) ? type : null,
      year,
      genre,
      poster: posterRaw || null,
      synopsis,
      rating: rating !== null && Number.isFinite(rating) ? rating : null,
      provenance: provenance.value,
    },
    issues
  );
}

export type OfferInput = ProvenanceInput & {
  countryCode?: unknown;
  currency?: unknown;
  amount?: unknown;
  billingCycle?: unknown;
  billingMonths?: unknown;
  taxIncluded?: unknown;
  displayName?: unknown;
  quality?: unknown;
  ads?: unknown;
  sourceType?: unknown;
  status?: unknown;
  lastCheckedAt?: unknown;
  lastSuccessAt?: unknown;
};

export type NormalizedOffer = {
  countryCode: string;
  currency: string;
  amount: number | null;
  billingCycle: BillingCycle | null;
  billingMonths: number;
  taxIncluded: boolean | null;
  displayName: string | null;
  quality: string | null;
  ads: boolean;
  sourceType: SourceType | null;
  status: OfferStatus;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
  provenance: NormalizedProvenance;
};

export function validateOfferInput(
  input: OfferInput,
  options: { now?: Date; requireProvenance?: boolean } = {}
): ValidationResult<NormalizedOffer> {
  const now = options.now ?? new Date();
  const issues: ValidationIssue[] = [];

  const countryCode = normalizeCountryCode(input.countryCode);
  if (!countryCode) {
    addIssue(issues, "countryCode", "REQUIRED", "país é obrigatório");
  } else if (!isCountry(countryCode)) {
    addIssue(issues, "countryCode", "UNSUPPORTED_COUNTRY", `país não suportado: ${countryCode}`);
  }

  const currency = normalizeCurrency(input.currency) || (isCountry(countryCode) ? getCountryCurrency(countryCode) : "");
  if (!currency) {
    addIssue(issues, "currency", "REQUIRED", "moeda é obrigatória");
  } else if (!isIsoCurrency(currency)) {
    addIssue(issues, "currency", "INVALID_CURRENCY", `moeda ISO 4217 inválida: ${currency}`);
  }
  if (isCountry(countryCode) && currency && currency !== getCountryCurrency(countryCode)) {
    addIssue(
      issues,
      "currency",
      "CURRENCY_COUNTRY_MISMATCH",
      `moeda ${currency} não corresponde ao país ${countryCode} (${getCountryCurrency(countryCode)})`
    );
  }

  const amount = parseAmount(input.amount);
  if (!Number.isFinite(amount)) {
    addIssue(issues, "amount", "INVALID_AMOUNT", "valor não numérico");
  } else if (amount <= 0) {
    addIssue(issues, "amount", "NON_POSITIVE_AMOUNT", "valor deve ser maior que zero");
  } else if (amount > LIMITS.maxAmount) {
    addIssue(
      issues,
      "amount",
      "IMPLAUSIBLE_AMOUNT",
      `valor acima do limite plausível (${LIMITS.maxAmount})`
    );
  }

  const billingCycleRaw = asString(input.billingCycle).toUpperCase();
  const billingCycle = (billingCycleRaw || "MONTHLY") as BillingCycle;
  if (!inList(billingCycle, BILLING_CYCLES)) {
    addIssue(
      issues,
      "billingCycle",
      "INVALID_BILLING_CYCLE",
      `ciclo inválido: ${billingCycleRaw}; use ${BILLING_CYCLES.join(", ")}`
    );
  }
  const expectedMonths = inList(billingCycle, BILLING_CYCLES)
    ? BILLING_CYCLE_MONTHS[billingCycle]
    : 1;
  const billingMonths =
    input.billingMonths === null ||
    input.billingMonths === undefined ||
    input.billingMonths === ""
      ? expectedMonths
      : Number(input.billingMonths);
  if (!Number.isInteger(billingMonths) || billingMonths <= 0) {
    addIssue(issues, "billingMonths", "INVALID_BILLING_MONTHS", "billingMonths deve ser inteiro positivo");
  } else if (billingMonths !== expectedMonths) {
    addIssue(
      issues,
      "billingMonths",
      "BILLING_MONTHS_MISMATCH",
      `billingMonths=${billingMonths}, esperado ${expectedMonths} para ${billingCycle}`
    );
  }

  const tax = asBoolean(input.taxIncluded);
  if (tax.invalid) {
    addIssue(issues, "taxIncluded", "INVALID_BOOLEAN", "taxIncluded deve ser true, false ou vazio");
  }
  const ads = asBoolean(input.ads);
  if (ads.invalid) {
    addIssue(issues, "ads", "INVALID_BOOLEAN", "ads deve ser true ou false");
  }

  const displayName = asOptionalString(input.displayName, LIMITS.displayName);
  const quality = asOptionalString(input.quality, LIMITS.quality);

  const sourceTypeRaw = asString(input.sourceType).toUpperCase();
  const sourceType = sourceTypeRaw ? (sourceTypeRaw as SourceType) : null;
  if (!sourceType) {
    addIssue(issues, "sourceType", "REQUIRED", "sourceType é obrigatório");
  } else if (!inList(sourceType, SOURCE_TYPES)) {
    addIssue(
      issues,
      "sourceType",
      "INVALID_SOURCE_TYPE",
      `sourceType inválido: ${sourceTypeRaw}`
    );
  }

  const sourceUrlRaw = asString(input.sourceUrl);
  if (sourceUrlRaw && !parseHttpUrl(sourceUrlRaw)) {
    addIssue(
      issues,
      "sourceUrl",
      "INVALID_SOURCE_URL",
      "sourceUrl precisa ser uma URL HTTP(S) válida"
    );
  }
  if (
    ["OFFICIAL_WEB", "HELP_CENTER"].includes(sourceTypeRaw) &&
    !sourceUrlRaw
  ) {
    addIssue(
      issues,
      "sourceUrl",
      "MISSING_SOURCE_URL",
      "ofertas de site oficial/help center exigem sourceUrl"
    );
  }

  const statusRaw = asString(input.status).toUpperCase();
  const status = (statusRaw || "ACTIVE") as OfferStatus;
  if (!inList(status, OFFER_STATUSES)) {
    addIssue(issues, "status", "INVALID_STATUS", `status inválido: ${statusRaw}`);
  }

  const lastCheckedAt = toUtcDate(input.lastCheckedAt);
  if (input.lastCheckedAt && !lastCheckedAt) {
    addIssue(issues, "lastCheckedAt", "INVALID_DATE", "lastCheckedAt inválido");
  }
  if (isFutureDate(lastCheckedAt, now)) {
    addIssue(issues, "lastCheckedAt", "FUTURE_DATE", "lastCheckedAt está no futuro");
  }
  const lastSuccessAt = toUtcDate(input.lastSuccessAt);
  if (input.lastSuccessAt && !lastSuccessAt) {
    addIssue(issues, "lastSuccessAt", "INVALID_DATE", "lastSuccessAt inválido");
  }
  if (isFutureDate(lastSuccessAt, now)) {
    addIssue(issues, "lastSuccessAt", "FUTURE_DATE", "lastSuccessAt está no futuro");
  }

  const provenance = validateProvenance(
    {
      ...input,
      source: input.source ?? sourceType,
    },
    {
      now,
      requireSource: options.requireProvenance ?? true,
    }
  );
  issues.push(...provenance.issues.map((issue) => ({ ...issue, field: `provenance.${issue.field}` })));
  if (
    provenance.value.verificationStatus === "VERIFIED" &&
    sourceType &&
    ["SEED", "LEGACY", "UNKNOWN"].includes(sourceType)
  ) {
    addIssue(
      issues,
      "verificationStatus",
      "SEED_CANNOT_BE_VERIFIED",
      "dados de seed/legado não podem ser marcados como VERIFIED sem nova verificação"
    );
  }

  return result(
    {
      countryCode,
      currency,
      amount: Number.isFinite(amount) ? amount : null,
      billingCycle: inList(billingCycle, BILLING_CYCLES) ? billingCycle : null,
      billingMonths,
      taxIncluded: tax.value,
      displayName,
      quality,
      ads: ads.value ?? false,
      sourceType: sourceType && inList(sourceType, SOURCE_TYPES) ? sourceType : null,
      status,
      lastCheckedAt: lastCheckedAt ?? null,
      lastSuccessAt: lastSuccessAt ?? null,
      provenance: provenance.value,
    },
    issues
  );
}

export type AvailabilityInput = ProvenanceInput & {
  contentId?: unknown;
  platformId?: unknown;
  countryCode?: unknown;
  available?: unknown;
  addedAt?: unknown;
  removedAt?: unknown;
};

export type NormalizedAvailability = {
  contentId: string;
  platformId: string;
  countryCode: string | null;
  available: boolean;
  addedAt: Date;
  removedAt: Date | null;
  provenance: NormalizedProvenance;
};

export function validateAvailabilityInput(
  input: AvailabilityInput,
  options: { now?: Date; requireProvenance?: boolean } = {}
): ValidationResult<NormalizedAvailability> {
  const now = options.now ?? new Date();
  const issues: ValidationIssue[] = [];

  const contentId = asString(input.contentId);
  if (!contentId) addIssue(issues, "contentId", "REQUIRED", "conteúdo é obrigatório");
  const platformId = asString(input.platformId);
  if (!platformId) addIssue(issues, "platformId", "REQUIRED", "plataforma é obrigatória");

  const countryCode = asString(input.countryCode).toUpperCase() || null;
  if (!countryCode) {
    addIssue(issues, "countryCode", "REQUIRED", "país é obrigatório");
  } else if (!isCountry(countryCode)) {
    addIssue(
      issues,
      "countryCode",
      "UNKNOWN_COUNTRY",
      `país não suportado: ${countryCode}`
    );
  }

  const availableParsed = asBoolean(input.available);
  if (availableParsed.invalid) {
    addIssue(issues, "available", "INVALID_BOOLEAN", "available deve ser booleano");
  }
  const available = availableParsed.value ?? true;

  const addedAt = toUtcDate(input.addedAt) ?? now;
  if (input.addedAt && !toUtcDate(input.addedAt)) {
    addIssue(issues, "addedAt", "INVALID_DATE", "addedAt inválido");
  }
  if (isFutureDate(addedAt, now)) {
    addIssue(issues, "addedAt", "FUTURE_DATE", "addedAt está no futuro");
  }

  const removedAt = toUtcDate(input.removedAt);
  if (input.removedAt && !removedAt) {
    addIssue(issues, "removedAt", "INVALID_DATE", "removedAt inválido");
  }
  if (removedAt && removedAt < addedAt) {
    addIssue(
      issues,
      "removedAt",
      "REMOVED_BEFORE_ADDED",
      "removedAt não pode ser anterior a addedAt"
    );
  }
  if (available && removedAt) {
    addIssue(
      issues,
      "removedAt",
      "AVAILABLE_WITH_REMOVED_AT",
      "registro disponível não pode ter removedAt"
    );
  }
  if (!available && !removedAt) {
    addIssue(
      issues,
      "removedAt",
      "MISSING_REMOVED_AT",
      "registro indisponível sem data de remoção; sinalizado para revisão",
      "WARNING"
    );
  }

  const provenance = validateProvenance(input, {
    now,
    requireSource: options.requireProvenance ?? true,
  });
  issues.push(...provenance.issues.map((issue) => ({ ...issue, field: `provenance.${issue.field}` })));

  return result(
    {
      contentId,
      platformId,
      countryCode: countryCode && isCountry(countryCode) ? countryCode : countryCode,
      available,
      addedAt,
      removedAt: removedAt ?? null,
      provenance: provenance.value,
    },
    issues
  );
}

export type PlatformCountryInput = ProvenanceInput & {
  platformId?: unknown;
  countryCode?: unknown;
  status?: unknown;
};

export type NormalizedPlatformCountry = {
  platformId: string;
  countryCode: string;
  status: PlatformCountryStatus;
  provenance: NormalizedProvenance;
};

export function validatePlatformCountryInput(
  input: PlatformCountryInput,
  options: { now?: Date; requireProvenance?: boolean } = {}
): ValidationResult<NormalizedPlatformCountry> {
  const now = options.now ?? new Date();
  const issues: ValidationIssue[] = [];
  const platformId = asString(input.platformId);
  if (!platformId) addIssue(issues, "platformId", "REQUIRED", "plataforma é obrigatória");

  const countryCode = normalizeCountryCode(input.countryCode);
  if (!countryCode) addIssue(issues, "countryCode", "REQUIRED", "país é obrigatório");
  else if (!isCountry(countryCode)) {
    addIssue(issues, "countryCode", "UNSUPPORTED_COUNTRY", `país não suportado: ${countryCode}`);
  }

  const statusRaw = asString(input.status).toUpperCase() || "UNKNOWN";
  const status = statusRaw as PlatformCountryStatus;
  if (!inList(status, PLATFORM_COUNTRY_STATUSES)) {
    addIssue(issues, "status", "INVALID_STATUS", `status inválido: ${statusRaw}`);
  }

  const provenance = validateProvenance(input, {
    now,
    requireSource: options.requireProvenance ?? true,
  });
  issues.push(...provenance.issues.map((issue) => ({ ...issue, field: `provenance.${issue.field}` })));

  return result(
    {
      platformId,
      countryCode,
      status,
      provenance: provenance.value,
    },
    issues
  );
}

export type PriceHistoryInput = {
  amount?: unknown;
  currency?: unknown;
  taxIncluded?: unknown;
  sourceType?: unknown;
  sourceUrl?: unknown;
  verificationStatus?: unknown;
  collectedAt?: unknown;
  recordedAt?: unknown;
};

export type NormalizedPriceHistory = {
  amount: number;
  currency: string;
  taxIncluded: boolean | null;
  sourceType: string | null;
  sourceUrl: string | null;
  verificationStatus: VerificationStatus;
  collectedAt: Date | null;
  recordedAt: Date;
};

export function validatePriceHistoryInput(
  input: PriceHistoryInput,
  options: { now?: Date } = {}
): ValidationResult<NormalizedPriceHistory> {
  const now = options.now ?? new Date();
  const issues: ValidationIssue[] = [];
  const amount = parseAmount(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    addIssue(issues, "amount", "INVALID_AMOUNT", "valor histórico deve ser numérico e positivo");
  }
  const currency = normalizeCurrency(input.currency);
  if (!isIsoCurrency(currency)) {
    addIssue(issues, "currency", "INVALID_CURRENCY", "moeda histórica inválida");
  }
  const recordedAt = toUtcDate(input.recordedAt) ?? now;
  if (isFutureDate(recordedAt, now)) {
    addIssue(issues, "recordedAt", "FUTURE_DATE", "recordedAt está no futuro");
  }
  const collectedAt = toUtcDate(input.collectedAt);
  if (input.collectedAt && !collectedAt) {
    addIssue(issues, "collectedAt", "INVALID_DATE", "collectedAt inválido");
  }
  const sourceUrl = asString(input.sourceUrl) || null;
  if (sourceUrl && !parseHttpUrl(sourceUrl)) {
    addIssue(issues, "sourceUrl", "INVALID_URL", "sourceUrl inválida");
  }
  const statusRaw = asString(input.verificationStatus).toUpperCase() || "UNVERIFIED";
  if (!inList(statusRaw, VERIFICATION_STATUSES)) {
    addIssue(issues, "verificationStatus", "INVALID_STATUS", "status inválido");
  }
  const tax = asBoolean(input.taxIncluded);
  if (tax.invalid) {
    addIssue(issues, "taxIncluded", "INVALID_BOOLEAN", "taxIncluded inválido");
  }

  return result(
    {
      amount,
      currency,
      taxIncluded: tax.value,
      sourceType: asString(input.sourceType).toUpperCase() || null,
      sourceUrl,
      verificationStatus: inList(statusRaw, VERIFICATION_STATUSES)
        ? (statusRaw as VerificationStatus)
        : "UNVERIFIED",
      collectedAt: collectedAt ?? null,
      recordedAt,
    },
    issues
  );
}

export type CollectionRunInput = {
  kind?: unknown;
  platformId?: unknown;
  countryCode?: unknown;
  source?: unknown;
  status?: unknown;
  httpStatus?: unknown;
  offersFound?: unknown;
  recordsCreated?: unknown;
  recordsUpdated?: unknown;
  recordsUnchanged?: unknown;
  recordsFailed?: unknown;
  errorCode?: unknown;
  error?: unknown;
  startedAt?: unknown;
  finishedAt?: unknown;
};

export type NormalizedCollectionRun = {
  kind: CollectionKind;
  platformId: string | null;
  countryCode: string | null;
  source: string | null;
  status: CollectionStatus;
  httpStatus: number | null;
  offersFound: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsUnchanged: number;
  recordsFailed: number;
  errorCode: CollectionErrorCode | null;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
};

export function validateCollectionRunInput(
  input: CollectionRunInput,
  options: { now?: Date } = {}
): ValidationResult<NormalizedCollectionRun> {
  const now = options.now ?? new Date();
  const issues: ValidationIssue[] = [];
  const kindRaw = asString(input.kind).toUpperCase() || "SCRAPE";
  if (!inList(kindRaw, COLLECTION_KINDS)) {
    addIssue(issues, "kind", "INVALID_KIND", `tipo de coleta inválido: ${kindRaw}`);
  }
  const statusRaw = asString(input.status).toUpperCase();
  if (!inList(statusRaw, COLLECTION_STATUSES)) {
    addIssue(issues, "status", "INVALID_STATUS", `status de coleta inválido: ${statusRaw}`);
  }
  const errorCodeRaw = asString(input.errorCode).toUpperCase() || null;
  if (errorCodeRaw && !inList(errorCodeRaw, COLLECTION_ERROR_CODES)) {
    addIssue(issues, "errorCode", "INVALID_ERROR_CODE", `código de erro inválido: ${errorCodeRaw}`);
  }

  const count = (name: string, value: unknown): number => {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      addIssue(issues, name, "INVALID_COUNT", `${name} deve ser inteiro não negativo`);
      return 0;
    }
    return parsed;
  };
  const startedAt = toUtcDate(input.startedAt) ?? now;
  if (isFutureDate(startedAt, now)) {
    addIssue(issues, "startedAt", "FUTURE_DATE", "startedAt está no futuro");
  }
  const finishedAt = toUtcDate(input.finishedAt);
  if (input.finishedAt && !finishedAt) {
    addIssue(issues, "finishedAt", "INVALID_DATE", "finishedAt inválido");
  }
  if (finishedAt && finishedAt < startedAt) {
    addIssue(issues, "finishedAt", "BEFORE_START", "finishedAt não pode ser anterior a startedAt");
  }

  return result(
    {
      kind: inList(kindRaw, COLLECTION_KINDS) ? (kindRaw as CollectionKind) : "SCRAPE",
      platformId: asString(input.platformId) || null,
      countryCode: normalizeCountryCode(input.countryCode) || null,
      source: asOptionalString(input.source, LIMITS.source),
      status: inList(statusRaw, COLLECTION_STATUSES)
        ? (statusRaw as CollectionStatus)
        : "FAILED",
      httpStatus:
        input.httpStatus === null || input.httpStatus === undefined || input.httpStatus === ""
          ? null
          : Number(input.httpStatus),
      offersFound: count("offersFound", input.offersFound),
      recordsCreated: count("recordsCreated", input.recordsCreated),
      recordsUpdated: count("recordsUpdated", input.recordsUpdated),
      recordsUnchanged: count("recordsUnchanged", input.recordsUnchanged),
      recordsFailed: count("recordsFailed", input.recordsFailed),
      errorCode: errorCodeRaw && inList(errorCodeRaw, COLLECTION_ERROR_CODES)
        ? (errorCodeRaw as CollectionErrorCode)
        : null,
      error: asOptionalString(input.error, LIMITS.issueMessage),
      startedAt,
      finishedAt: finishedAt ?? null,
    },
    issues
  );
}

export function assertValid<T>(
  validation: ValidationResult<T>,
  label: string
): T {
  if (!validation.ok) {
    throw new DataQualityValidationError(label, validation.issues);
  }
  return validation.value;
}

/** Helper para detectar se um nome/URL já existe (case/acentos ignorados). */
export function sameNormalizedName(a: string, b: string): boolean {
  return normalizeNameKey(a) === normalizeNameKey(b);
}

export function sameComparableText(a: string, b: string): boolean {
  return normalizeComparableText(a) === normalizeComparableText(b);
}

export function isKnownEntityType(value: string): value is EntityType {
  return [
    "PLATFORM",
    "PLAN",
    "PLAN_OFFER",
    "CONTENT",
    "CONTENT_AVAILABILITY",
    "PLATFORM_COUNTRY",
    "PRICE_SOURCE",
    "COLLECTION_RUN",
  ].includes(value);
}

export function isKnownIssueSeverity(value: string): value is "ERROR" | "WARNING" | "INFO" {
  return inList(value, ISSUE_SEVERITIES);
}
