import type { PrismaClient } from "@/app/generated/prisma/client";
import { countries, getCountryCurrency } from "@/lib/countries";
import { fingerprint, sanitizeForLog, sha256Hex, stableStringify } from "./normalize";
import {
  detectAllDuplicates,
  type DuplicateCandidate,
} from "./duplicates";
import {
  ISSUE_RULES,
  ISSUE_SEVERITIES,
  type EntityType,
  type IssueSeverity,
} from "./constants";
import {
  validateAvailabilityInput,
  validateContentInput,
  validateOfferInput,
  validatePlanInput,
  validatePlatformCountryInput,
  validatePlatformInput,
  type ValidationIssue,
} from "./validation";
import { evaluateFreshness, getFreshnessPolicy } from "./freshness";
import type { IssueDb } from "./types";
import type { FreshnessPolicyKey } from "./constants";

export type QualityIssueInput = {
  fingerprint?: string;
  entityType: EntityType;
  entityIds: string[];
  rule: string;
  severity: IssueSeverity;
  message: string;
  details?: Record<string, unknown>;
};

export type IssueScanSummary = {
  scannedAt: string;
  detected: number;
  opened: number;
  updated: number;
  resolved: number;
  byRule: Record<string, number>;
  bySeverity: Record<string, number>;
};

function issueFingerprint(input: QualityIssueInput): string {
  return (
    input.fingerprint ??
    fingerprint(input.rule, [...input.entityIds].sort())
  );
}

function detailsJson(details: Record<string, unknown> | undefined): string | null {
  if (!details) return null;
  return stableStringify(sanitizeForLog(details));
}

/**
 * Registra/atualiza um problema. Nunca altera o registro original.
 * Se o problema reaparece depois de RESOLVED, volta para OPEN.
 */
export async function recordIssue(
  db: IssueDb,
  input: QualityIssueInput,
  now: Date = new Date()
): Promise<{ created: boolean; reopened: boolean }> {
  const key = issueFingerprint(input);
  const existing = await db.dataQualityIssue.findUnique({
    where: { fingerprint: key },
  });

  if (!existing) {
    await db.dataQualityIssue.create({
      data: {
        fingerprint: key,
        entityType: input.entityType,
        entityIds: JSON.stringify([...new Set(input.entityIds)]),
        rule: input.rule,
        severity: input.severity,
        message: input.message,
        details: detailsJson(input.details),
        status: "OPEN",
        detectedAt: now,
        lastSeenAt: now,
      },
    });
    return { created: true, reopened: false };
  }

  const ignored = existing.status === "IGNORED";
  const reopened = existing.status === "RESOLVED";
  await db.dataQualityIssue.update({
    where: { id: existing.id },
    data: {
      entityType: input.entityType,
      entityIds: JSON.stringify([...new Set(input.entityIds)]),
      rule: input.rule,
      severity: input.severity,
      message: input.message,
      details: detailsJson(input.details),
      lastSeenAt: now,
      status: ignored ? "IGNORED" : reopened ? "OPEN" : existing.status,
      resolvedAt: reopened ? null : existing.resolvedAt,
      resolutionNote: reopened ? null : existing.resolutionNote,
    },
  });
  return { created: false, reopened };
}

function validationFingerprint(
  entityType: EntityType,
  entityId: string,
  issue: ValidationIssue
): string {
  return sha256Hex(
    `${ISSUE_RULES.VALIDATION_ERROR}:${entityType}:${entityId}:${issue.field}:${issue.code}`
  );
}

function collectValidation(
  target: QualityIssueInput[],
  entityType: EntityType,
  entityId: string,
  label: string,
  issues: ValidationIssue[]
) {
  for (const issue of issues) {
    if (issue.severity !== "ERROR") continue;
    target.push({
      fingerprint: validationFingerprint(entityType, entityId, issue),
      entityType,
      entityIds: [entityId],
      rule: ISSUE_RULES.VALIDATION_ERROR,
      severity: "ERROR",
      message: `${label}: ${issue.field} — ${issue.message}`,
      details: {
        field: issue.field,
        code: issue.code,
        validation: issue.message,
      },
    });
  }
}

function candidateToIssue(candidate: DuplicateCandidate): QualityIssueInput {
  return {
    fingerprint: fingerprint(candidate.rule, candidate.entityIds),
    entityType: candidate.entityType,
    entityIds: candidate.entityIds,
    rule: candidate.rule,
    severity: candidate.severity,
    message: candidate.message,
    details: {
      confidence: candidate.confidence,
      ...candidate.details,
    },
  };
}

/**
 * Varre o banco em busca de duplicidades, inconsistências e violações de
 * validação. Grava apenas DataQualityIssue; não apaga nem mescla registros.
 */
export async function scanDataQuality(
  prisma: PrismaClient,
  options: { now?: Date } = {}
): Promise<IssueScanSummary> {
  const now = options.now ?? new Date();

  const [
    platforms,
    platformCountries,
    plans,
    offers,
    contents,
    availability,
  ] = await Promise.all([
    prisma.platform.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        website: true,
        logo: true,
        color: true,
        source: true,
        sourceUrl: true,
        collectionMethod: true,
        collectedAt: true,
        lastVerifiedAt: true,
        verificationStatus: true,
      },
    }),
    prisma.platformCountry.findMany({
      select: {
        platformId: true,
        countryCode: true,
        status: true,
        source: true,
        sourceUrl: true,
        collectionMethod: true,
        collectedAt: true,
        lastVerifiedAt: true,
        verificationStatus: true,
      },
    }),
    prisma.plan.findMany({
      select: {
        id: true,
        platformId: true,
        tierKey: true,
        name: true,
        source: true,
        sourceUrl: true,
        collectionMethod: true,
        collectedAt: true,
        lastVerifiedAt: true,
        verificationStatus: true,
      },
    }),
    prisma.planOffer.findMany({
      select: {
        id: true,
        planId: true,
        countryCode: true,
        currency: true,
        amount: true,
        billingCycle: true,
        billingMonths: true,
        taxIncluded: true,
        displayName: true,
        quality: true,
        ads: true,
        sourceUrl: true,
        sourceType: true,
        collectionMethod: true,
        status: true,
        verificationStatus: true,
        collectedAt: true,
        lastVerifiedAt: true,
        lastCheckedAt: true,
        lastSuccessAt: true,
        plan: { select: { platformId: true, name: true, tierKey: true } },
        history: {
          orderBy: { recordedAt: "desc" },
          take: 1,
          select: { amount: true },
        },
      },
    }),
    prisma.content.findMany({
      select: {
        id: true,
        title: true,
        originalTitle: true,
        slug: true,
        externalSource: true,
        externalId: true,
        type: true,
        year: true,
        genre: true,
        poster: true,
        synopsis: true,
        rating: true,
        source: true,
        sourceUrl: true,
        collectionMethod: true,
        collectedAt: true,
        lastVerifiedAt: true,
        verificationStatus: true,
      },
    }),
    prisma.contentAvailability.findMany({
      select: {
        id: true,
        contentId: true,
        platformId: true,
        countryCode: true,
        available: true,
        addedAt: true,
        removedAt: true,
        source: true,
        sourceUrl: true,
        collectionMethod: true,
        collectedAt: true,
        lastVerifiedAt: true,
        verificationStatus: true,
      },
    }),
  ]);

  const expectedCurrencyByCountry = Object.fromEntries(
    countries.map((country) => [country.code, getCountryCurrency(country.code)])
  );

  const duplicateCandidates = detectAllDuplicates({
    platforms,
    contents,
    plans,
    offers: offers.map((offer) => ({
      id: offer.id,
      planId: offer.planId,
      platformId: offer.plan.platformId,
      planName: offer.plan.name,
      tierKey: offer.plan.tierKey,
      countryCode: offer.countryCode,
      currency: offer.currency,
      amount: Number(offer.amount),
      billingCycle: offer.billingCycle,
      billingMonths: offer.billingMonths,
      ads: offer.ads,
      displayName: offer.displayName,
      status: offer.status,
      latestHistoryAmount:
        offer.history.length > 0 ? Number(offer.history[0].amount) : null,
    })),
    availability,
    countries: [
      ...platformCountries.map((row) => ({
        id: `${row.platformId}:${row.countryCode}`,
        entityType: "PLATFORM_COUNTRY" as const,
        countryCode: row.countryCode,
      })),
      ...offers.map((offer) => ({
        id: offer.id,
        entityType: "PLAN_OFFER" as const,
        countryCode: offer.countryCode,
      })),
    ],
    expectedCurrencyByCountry,
  });

  const validationIssues: QualityIssueInput[] = [];

  for (const platform of platforms) {
    const operating = platformCountries
      .filter(
        (row) =>
          row.platformId === platform.id && row.status === "OPERATES"
      )
      .map((row) => row.countryCode);
    const validation = validatePlatformInput(
      { ...platform, countryCodes: operating },
      { now, requireProvenance: false }
    );
    collectValidation(
      validationIssues,
      "PLATFORM",
      platform.id,
      platform.name,
      validation.issues
    );
  }

  for (const plan of plans) {
    const validation = validatePlanInput(plan, {
      now,
      requireProvenance: false,
    });
    collectValidation(
      validationIssues,
      "PLAN",
      plan.id,
      `Plano ${plan.name}`,
      validation.issues
    );
  }

  for (const content of contents) {
    const validation = validateContentInput(content, {
      now,
      requireProvenance: false,
    });
    collectValidation(
      validationIssues,
      "CONTENT",
      content.id,
      content.title,
      validation.issues
    );
  }

  for (const offer of offers) {
    const validation = validateOfferInput(
      {
        ...offer,
        source: offer.sourceType,
        amount: Number(offer.amount),
      },
      { now, requireProvenance: false }
    );
    collectValidation(
      validationIssues,
      "PLAN_OFFER",
      offer.id,
      `${offer.plan.name} / ${offer.countryCode} / ${offer.billingCycle}`,
      validation.issues
    );
  }

  for (const row of availability) {
    const validation = validateAvailabilityInput(row, {
      now,
      requireProvenance: false,
    });
    collectValidation(
      validationIssues,
      "CONTENT_AVAILABILITY",
      row.id,
      `Disponibilidade ${row.id}`,
      validation.issues
    );
  }

  for (const row of platformCountries) {
    const validation = validatePlatformCountryInput(row, {
      now,
      requireProvenance: false,
    });
    collectValidation(
      validationIssues,
      "PLATFORM_COUNTRY",
      `${row.platformId}:${row.countryCode}`,
      `Plataforma ${row.platformId} / ${row.countryCode}`,
      validation.issues
    );
  }

  // Dados verificados que envelheceram. Um registro nunca verificado não é
  // "desatualizado": ele já é reportado como UNVERIFIED nos indicadores.
  const staleIssues: QualityIssueInput[] = [];
  const staleChecks: Array<{
    entityType: EntityType;
    policyKey: FreshnessPolicyKey;
    rows: Array<{
      id: string;
      label: string;
      verificationStatus: string;
      lastVerifiedAt: Date | null;
    }>;
  }> = [
    {
      entityType: "PLATFORM",
      policyKey: "platform",
      rows: platforms.map((row) => ({
        id: row.id,
        label: row.name,
        verificationStatus: row.verificationStatus,
        lastVerifiedAt: row.lastVerifiedAt,
      })),
    },
    {
      entityType: "CONTENT",
      policyKey: "content",
      rows: contents.map((row) => ({
        id: row.id,
        label: row.title,
        verificationStatus: row.verificationStatus,
        lastVerifiedAt: row.lastVerifiedAt,
      })),
    },
    {
      entityType: "PLAN_OFFER",
      policyKey: "offer",
      rows: offers.map((row) => ({
        id: row.id,
        label: `${row.plan.name} / ${row.countryCode} / ${row.billingCycle}`,
        verificationStatus: row.verificationStatus,
        lastVerifiedAt: row.lastVerifiedAt,
      })),
    },
    {
      entityType: "CONTENT_AVAILABILITY",
      policyKey: "availability",
      rows: availability.map((row) => ({
        id: row.id,
        label: `Disponibilidade ${row.id}`,
        verificationStatus: row.verificationStatus,
        lastVerifiedAt: row.lastVerifiedAt,
      })),
    },
    {
      entityType: "PLATFORM_COUNTRY",
      policyKey: "platform-country",
      rows: platformCountries.map((row) => ({
        id: `${row.platformId}:${row.countryCode}`,
        label: `Plataforma ${row.platformId} / ${row.countryCode}`,
        verificationStatus: row.verificationStatus,
        lastVerifiedAt: row.lastVerifiedAt,
      })),
    },
  ];

  for (const group of staleChecks) {
    const policy = getFreshnessPolicy(group.policyKey);
    for (const row of group.rows) {
      if (row.verificationStatus !== "VERIFIED") continue;
      const freshness = evaluateFreshness(row.lastVerifiedAt, policy, now);
      if (freshness.state !== "STALE") continue;
      staleIssues.push({
        entityType: group.entityType,
        entityIds: [row.id],
        rule: ISSUE_RULES.STALE_DATA,
        severity: "WARNING",
        message: `${row.label}: verificado há ${Math.round(freshness.ageHours ?? 0)}h (limite ${policy.maxAgeHours}h)`,
        details: {
          lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
          ageHours: Math.round(freshness.ageHours ?? 0),
          maxAgeHours: policy.maxAgeHours,
        },
      });
    }
  }

  const detected = [
    ...duplicateCandidates.map(candidateToIssue),
    ...validationIssues,
    ...staleIssues,
  ];

  const seen = new Set<string>();
  let opened = 0;
  let updated = 0;
  for (const issue of detected) {
    const key = issueFingerprint(issue);
    if (seen.has(key)) continue;
    seen.add(key);
    const outcome = await recordIssue(prisma, issue, now);
    if (outcome.created || outcome.reopened) opened++;
    else updated++;
  }

  const scannedRules = new Set<string>([
    ...Object.values(ISSUE_RULES).filter(
      (rule) =>
        rule !== ISSUE_RULES.VALIDATION_WARNING &&
        rule !== ISSUE_RULES.AVAILABILITY_INCONSISTENT
    ),
    ISSUE_RULES.AVAILABILITY_INCONSISTENT,
  ]);

  const openIssues = await prisma.dataQualityIssue.findMany({
    where: {
      rule: { in: [...scannedRules] },
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
    select: { id: true, fingerprint: true },
  });
  let resolved = 0;
  for (const issue of openIssues) {
    if (seen.has(issue.fingerprint)) continue;
    await prisma.dataQualityIssue.update({
      where: { id: issue.id },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
        resolutionNote: "Não detectado na varredura automática.",
      },
    });
    resolved++;
  }

  const byRule: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const issue of detected) {
    byRule[issue.rule] = (byRule[issue.rule] ?? 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
  }

  return {
    scannedAt: now.toISOString(),
    detected: seen.size,
    opened,
    updated,
    resolved,
    byRule,
    bySeverity,
  };
}

/** Marca como IGNORED sem apagar o histórico do problema. */
export async function ignoreIssue(
  db: IssueDb,
  fingerprintValue: string,
  note?: string,
  now: Date = new Date()
): Promise<boolean> {
  const issue = await db.dataQualityIssue.findUnique({
    where: { fingerprint: fingerprintValue },
  });
  if (!issue) return false;
  await db.dataQualityIssue.update({
    where: { id: issue.id },
    data: {
      status: "IGNORED",
      resolvedAt: now,
      resolutionNote: note?.trim() || "Ignorado manualmente.",
    },
  });
  return true;
}

/** Lista problemas abertos para revisão, sem expor dados sensíveis. */
export async function listOpenIssues(
  prisma: PrismaClient,
  options: { limit?: number; severity?: IssueSeverity } = {}
) {
  const severity = options.severity;
  if (severity && !ISSUE_SEVERITIES.includes(severity)) {
    throw new Error(`severidade inválida: ${severity}`);
  }
  return prisma.dataQualityIssue.findMany({
    where: {
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
      ...(severity ? { severity } : {}),
    },
    orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
    take: options.limit ?? 100,
  });
}
