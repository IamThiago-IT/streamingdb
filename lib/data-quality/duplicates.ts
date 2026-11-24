import { isCountry } from "@/lib/countries";
import {
  ISSUE_RULES,
  MONEY_EPSILON,
  type EntityType,
  type IssueSeverity,
} from "./constants";
import {
  normalizeComparableText,
  normalizeNameKey,
  textSimilarity,
  websiteKey,
} from "./normalize";

export type DuplicateConfidence = "HIGH" | "MEDIUM" | "LOW";

export type DuplicateCandidate = {
  rule: string;
  entityType: EntityType;
  entityIds: string[];
  severity: IssueSeverity;
  confidence: DuplicateConfidence;
  message: string;
  details: Record<string, unknown>;
};

export type PlatformRecord = {
  id: string;
  name: string;
  slug: string;
  website?: string | null;
};

export type ContentRecord = {
  id: string;
  title: string;
  originalTitle?: string | null;
  slug: string;
  type: string;
  year?: number | null;
  externalSource?: string | null;
  externalId?: string | null;
};

export type PlanRecord = {
  id: string;
  platformId: string;
  tierKey?: string | null;
  name: string;
};

export type OfferRecord = {
  id: string;
  planId: string;
  platformId: string;
  planName?: string;
  tierKey?: string | null;
  countryCode: string;
  currency: string;
  amount: number;
  billingCycle: string;
  billingMonths?: number;
  ads: boolean;
  displayName?: string | null;
  status?: string;
  latestHistoryAmount?: number | null;
};

export type AvailabilityRecord = {
  id: string;
  contentId: string;
  platformId: string;
  countryCode: string;
  available: boolean;
  addedAt: Date | string;
  removedAt: Date | string | null;
};

export type CountryRecord = {
  id: string;
  entityType: EntityType;
  countryCode: string;
};

function pairKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

function candidate(
  rule: string,
  entityType: EntityType,
  entityIds: string[],
  message: string,
  details: Record<string, unknown>,
  options: {
    severity?: IssueSeverity;
    confidence?: DuplicateConfidence;
  } = {}
): DuplicateCandidate {
  return {
    rule,
    entityType,
    entityIds: [...new Set(entityIds)].sort(),
    severity: options.severity ?? "WARNING",
    confidence: options.confidence ?? "MEDIUM",
    message,
    details,
  };
}

/** Remove candidatos repetidos (mesma regra + mesmos ids). */
export function dedupeCandidates(
  candidates: DuplicateCandidate[]
): DuplicateCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((item) => {
    const key = `${item.rule}:${pairKey(item.entityIds)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Detecta plataformas duplicadas por slug, domínio ou nome normalizado.
 * Um par é reportado uma vez, com todas as evidências encontradas.
 */
export function detectPlatformDuplicates(
  platforms: PlatformRecord[]
): DuplicateCandidate[] {
  const pairs = new Map<
    string,
    {
      ids: string[];
      reasons: string[];
      rules: string[];
      confidence: DuplicateConfidence;
      evidence: Record<string, unknown>;
    }
  >();

  const addPair = (
    a: PlatformRecord,
    b: PlatformRecord,
    rule: string,
    reason: string,
    evidence: Record<string, unknown>,
    confidence: DuplicateConfidence
  ) => {
    if (a.id === b.id) return;
    const ids = [a.id, b.id].sort();
    const key = pairKey(ids);
    const current = pairs.get(key);
    if (current) {
      if (!current.reasons.includes(reason)) current.reasons.push(reason);
      if (!current.rules.includes(rule)) current.rules.push(rule);
      current.evidence = { ...current.evidence, ...evidence };
      if (confidence === "HIGH") current.confidence = "HIGH";
    } else {
      pairs.set(key, {
        ids,
        reasons: [reason],
        rules: [rule],
        confidence,
        evidence,
      });
    }
  };

  const slugGroups = groupBy(platforms, (p) => normalizeNameKey(p.slug));
  for (const group of slugGroups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        addPair(
          group[i],
          group[j],
          ISSUE_RULES.DUPLICATE_PLATFORM_SLUG,
          `slug normalizado "${group[i].slug}"`,
          { slugs: [group[i].slug, group[j].slug] },
          "HIGH"
        );
      }
    }
  }

  const websiteGroups = groupBy(
    platforms.filter((p) => websiteKey(p.website)),
    (p) => websiteKey(p.website) ?? ""
  );
  for (const group of websiteGroups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        addPair(
          group[i],
          group[j],
          ISSUE_RULES.DUPLICATE_PLATFORM_WEBSITE,
          `mesmo site (${websiteKey(group[i].website)})`,
          { websites: [group[i].website, group[j].website] },
          "HIGH"
        );
      }
    }
  }

  const nameGroups = groupBy(platforms, (p) => normalizeNameKey(p.name));
  for (const group of nameGroups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        addPair(
          group[i],
          group[j],
          ISSUE_RULES.DUPLICATE_PLATFORM_NAME,
          `nome normalizado "${group[i].name}"`,
          { names: [group[i].name, group[j].name] },
          "MEDIUM"
        );
      }
    }
  }

  return [...pairs.values()].map((pair) =>
    candidate(
      pair.rules[0],
      "PLATFORM",
      pair.ids,
      `Possível plataforma duplicada: ${pair.reasons.join("; ")}`,
      { reasons: pair.reasons, rules: pair.rules, ...pair.evidence },
      { severity: "ERROR", confidence: pair.confidence }
    )
  );
}

function contentTitleVariants(content: ContentRecord): string[] {
  return [content.title, content.originalTitle ?? ""]
    .map((value) => normalizeComparableText(value))
    .filter(Boolean);
}

function contentsLookAlike(a: ContentRecord, b: ContentRecord): number {
  const left = contentTitleVariants(a);
  const right = contentTitleVariants(b);
  let best = 0;
  for (const x of left) {
    for (const y of right) {
      best = Math.max(best, textSimilarity(x, y));
    }
  }
  return best;
}

/**
 * Detecta duplicidades de conteúdo por identificador externo, título+ano+tipo
 * e similaridade alta. Mesmo título com anos diferentes é remake legítimo e
 * não é sinalizado.
 */
export function detectContentDuplicates(
  contents: ContentRecord[]
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];

  const externalGroups = groupBy(
    contents.filter((content) => content.externalSource && content.externalId),
    (content) =>
      `${(content.externalSource ?? "").toUpperCase()}:${(content.externalId ?? "").trim()}`
  );
  for (const group of externalGroups.values()) {
    if (group.length < 2) continue;
    const titles = new Set(group.map((item) => normalizeComparableText(item.title)));
    const conflicting = titles.size > 1;
    candidates.push(
      candidate(
        conflicting
          ? ISSUE_RULES.CONFLICTING_CONTENT_EXTERNAL_ID
          : ISSUE_RULES.DUPLICATE_CONTENT_EXTERNAL_ID,
        "CONTENT",
        group.map((item) => item.id),
        conflicting
          ? "Identificador externo compartilhado por títulos diferentes"
          : "Mesmo identificador externo em mais de um registro",
        {
          externalSource: group[0].externalSource,
          externalId: group[0].externalId,
          titles: group.map((item) => item.title),
        },
        { severity: "ERROR", confidence: "HIGH" }
      )
    );
  }

  const exactGroups = groupBy(
    contents,
    (content) =>
      `${normalizeComparableText(content.title)}|${content.year ?? "unknown"}|${content.type}`
  );
  for (const group of exactGroups.values()) {
    if (group.length < 2) continue;
    candidates.push(
      candidate(
        ISSUE_RULES.DUPLICATE_CONTENT_TITLE,
        "CONTENT",
        group.map((item) => item.id),
        `Título, ano e tipo iguais: "${group[0].title}" (${group[0].year ?? "ano desconhecido"})`,
        {
          title: group[0].title,
          year: group[0].year ?? null,
          type: group[0].type,
        },
        {
          severity: "ERROR",
          confidence: group[0].year ? "HIGH" : "LOW",
        }
      )
    );
  }

  // Similaridade alta só é comparada quando tipo e ano coincidem. Sem ano,
  // fica como baixa confiança e não bloqueia nada automaticamente.
  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
      const a = contents[i];
      const b = contents[j];
      if (a.type !== b.type) continue;
      const sameYear = a.year != null && b.year != null && a.year === b.year;
      const noYear = a.year == null || b.year == null;
      if (!sameYear && !noYear) continue;
      const key = `${normalizeComparableText(a.title)}|${a.year ?? "unknown"}|${a.type}`;
      const otherKey = `${normalizeComparableText(b.title)}|${b.year ?? "unknown"}|${b.type}`;
      if (key === otherKey) continue; // já coberto pelo grupo exato
      const similarity = contentsLookAlike(a, b);
      if (similarity < 0.92) continue;
      candidates.push(
        candidate(
          ISSUE_RULES.DUPLICATE_CONTENT_TITLE,
          "CONTENT",
          [a.id, b.id],
          `Títulos muito semelhantes: "${a.title}" × "${b.title}"`,
          {
            titles: [a.title, b.title],
            originalTitles: [a.originalTitle ?? null, b.originalTitle ?? null],
            years: [a.year ?? null, b.year ?? null],
            type: a.type,
            similarity: Number(similarity.toFixed(3)),
          },
          { severity: "WARNING", confidence: sameYear ? "MEDIUM" : "LOW" }
        )
      );
    }
  }

  return dedupeCandidates(candidates);
}

/**
 * Detecta tiers repetidos na mesma plataforma e ofertas com a mesma assinatura
 * comercial em planos diferentes. Nunca mescla nem apaga ofertas.
 */
export function detectOfferDuplicates(
  plans: PlanRecord[],
  offers: OfferRecord[]
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];

  const planGroups = groupBy(plans, (plan) =>
    `${plan.platformId}|${normalizeNameKey(plan.tierKey || plan.name)}`
  );
  for (const group of planGroups.values()) {
    if (group.length < 2) continue;
    candidates.push(
      candidate(
        ISSUE_RULES.DUPLICATE_PLAN_TIER,
        "PLAN",
        group.map((plan) => plan.id),
        `Tier repetido na mesma plataforma: "${group[0].tierKey ?? group[0].name}"`,
        {
          platformId: group[0].platformId,
          tierKeys: group.map((plan) => plan.tierKey),
          names: group.map((plan) => plan.name),
        },
        { severity: "ERROR", confidence: "HIGH" }
      )
    );
  }

  const exactGroups = groupBy(
    offers,
    (offer) =>
      `${offer.planId}|${offer.countryCode}|${offer.billingCycle}`
  );
  for (const group of exactGroups.values()) {
    if (group.length < 2) continue;
    candidates.push(
      candidate(
        ISSUE_RULES.DUPLICATE_OFFER,
        "PLAN_OFFER",
        group.map((offer) => offer.id),
        "Mais de uma oferta para o mesmo plano, país e ciclo",
        { offers: group.map((offer) => offer.id) },
        { severity: "ERROR", confidence: "HIGH" }
      )
    );
  }

  // Assinatura comercial igual em planos diferentes: possível plano duplicado
  // ou oferta cadastrada no tier errado. Sinaliza para revisão.
  const signatureGroups = groupBy(offers, (offer) => {
    const label = normalizeNameKey(offer.displayName || offer.planName || "");
    return [
      offer.platformId,
      offer.countryCode,
      offer.billingCycle,
      offer.currency,
      offer.amount.toFixed(2),
      offer.ads ? "ads" : "no-ads",
      label,
    ].join("|");
  });
  for (const group of signatureGroups.values()) {
    const planIds = new Set(group.map((offer) => offer.planId));
    if (planIds.size < 2) continue;
    candidates.push(
      candidate(
        ISSUE_RULES.DUPLICATE_OFFER,
        "PLAN_OFFER",
        group.map((offer) => offer.id),
        `Ofertas com a mesma assinatura comercial em ${planIds.size} planos`,
        {
          planIds: [...planIds],
          signature: {
            countryCode: group[0].countryCode,
            currency: group[0].currency,
            amount: group[0].amount,
            billingCycle: group[0].billingCycle,
            ads: group[0].ads,
          },
        },
        { severity: "WARNING", confidence: "MEDIUM" }
      )
    );
  }

  return dedupeCandidates(candidates);
}

export function detectAvailabilityDuplicates(
  availability: AvailabilityRecord[]
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  const groups = groupBy(
    availability,
    (row) => `${row.contentId}|${row.platformId}|${row.countryCode}`
  );
  for (const group of groups.values()) {
    if (group.length > 1) {
      candidates.push(
        candidate(
          ISSUE_RULES.DUPLICATE_AVAILABILITY,
          "CONTENT_AVAILABILITY",
          group.map((row) => row.id),
          "Mais de um registro de disponibilidade para o mesmo conteúdo/plataforma/país",
          {
            contentId: group[0].contentId,
            platformId: group[0].platformId,
            countryCode: group[0].countryCode,
          },
          { severity: "ERROR", confidence: "HIGH" }
        )
      );
    }
  }

  for (const row of availability) {
    const added = new Date(row.addedAt);
    const removed = row.removedAt ? new Date(row.removedAt) : null;
    if (row.available && removed) {
      candidates.push(
        candidate(
          ISSUE_RULES.AVAILABILITY_INCONSISTENT,
          "CONTENT_AVAILABILITY",
          [row.id],
          "Disponibilidade marcada como ativa, mas com data de remoção",
          { available: row.available, removedAt: removed.toISOString() },
          { severity: "ERROR", confidence: "HIGH" }
        )
      );
    }
    if (removed && !Number.isNaN(added.getTime()) && removed < added) {
      candidates.push(
        candidate(
          ISSUE_RULES.AVAILABILITY_INCONSISTENT,
          "CONTENT_AVAILABILITY",
          [row.id],
          "Data de remoção anterior à data de inclusão",
          {
            addedAt: added.toISOString(),
            removedAt: removed.toISOString(),
          },
          { severity: "ERROR", confidence: "HIGH" }
        )
      );
    }
    if (!row.available && !removed) {
      candidates.push(
        candidate(
          ISSUE_RULES.AVAILABILITY_INCONSISTENT,
          "CONTENT_AVAILABILITY",
          [row.id],
          "Disponibilidade inativa sem data de remoção conhecida",
          { available: row.available },
          { severity: "WARNING", confidence: "MEDIUM" }
        )
      );
    }
  }

  return dedupeCandidates(candidates);
}

/** Sinaliza país com nomenclatura fora do padrão ISO ou não suportado. */
export function detectCountryNomenclature(
  records: CountryRecord[]
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  for (const record of records) {
    const raw = String(record.countryCode ?? "");
    const trimmed = raw.trim();
    const normalized = trimmed.toUpperCase();
    const supported = isCountry(normalized);
    const needsNormalization = raw !== trimmed || trimmed !== normalized;
    if (!supported || needsNormalization) {
      candidates.push(
        candidate(
          ISSUE_RULES.COUNTRY_NOMENCLATURE,
          record.entityType,
          [record.id],
          !supported
            ? `País não suportado: "${raw}"`
            : `País fora do padrão ISO: "${raw}" (use "${normalized}")`,
          {
            raw,
            normalized,
            supported,
          },
          { severity: supported ? "WARNING" : "ERROR", confidence: "HIGH" }
        )
      );
    }
  }
  return dedupeCandidates(candidates);
}

/** Inconsistências monetárias que não são detectáveis só pela validação. */
export function detectMonetaryInconsistencies(
  offers: OfferRecord[],
  expectedCurrencyByCountry: Record<string, string> = {}
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  for (const offer of offers) {
    const expected = expectedCurrencyByCountry[offer.countryCode];
    if (expected && offer.currency !== expected) {
      candidates.push(
        candidate(
          ISSUE_RULES.CURRENCY_COUNTRY_MISMATCH,
          "PLAN_OFFER",
          [offer.id],
          `Moeda ${offer.currency} não corresponde ao país ${offer.countryCode} (${expected})`,
          { countryCode: offer.countryCode, currency: offer.currency, expected },
          { severity: "ERROR", confidence: "HIGH" }
        )
      );
    }

    if (
      offer.latestHistoryAmount != null &&
      Number.isFinite(offer.latestHistoryAmount) &&
      Math.abs(offer.latestHistoryAmount - offer.amount) > MONEY_EPSILON
    ) {
      candidates.push(
        candidate(
          ISSUE_RULES.AMOUNT_HISTORY_MISMATCH,
          "PLAN_OFFER",
          [offer.id],
          "Valor atual difere do último registro do histórico de preço",
          {
            amount: offer.amount,
            latestHistoryAmount: offer.latestHistoryAmount,
            currency: offer.currency,
          },
          { severity: "WARNING", confidence: "MEDIUM" }
        )
      );
    }
  }
  return dedupeCandidates(candidates);
}

export function detectAllDuplicates(input: {
  platforms: PlatformRecord[];
  contents: ContentRecord[];
  plans: PlanRecord[];
  offers: OfferRecord[];
  availability: AvailabilityRecord[];
  countries?: CountryRecord[];
  expectedCurrencyByCountry?: Record<string, string>;
}): DuplicateCandidate[] {
  return dedupeCandidates([
    ...detectPlatformDuplicates(input.platforms),
    ...detectContentDuplicates(input.contents),
    ...detectOfferDuplicates(input.plans, input.offers),
    ...detectAvailabilityDuplicates(input.availability),
    ...detectCountryNomenclature(input.countries ?? []),
    ...detectMonetaryInconsistencies(
      input.offers,
      input.expectedCurrencyByCountry
    ),
  ]);
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
