import type { PrismaClient } from "@/app/generated/prisma/client";
import {
  FRESHNESS_POLICIES,
  ISSUE_SEVERITIES,
  type FreshnessPolicyKey,
} from "./constants";
import {
  evaluateFreshness,
  getFreshnessPolicy,
  staleCutoff,
  type FreshnessEvaluation,
} from "./freshness";

export type EntityQualityMetric = {
  entityType: string;
  label: string;
  total: number;
  verified: number;
  unverified: number;
  needsReview: number;
  rejected: number;
  neverVerified: number;
  stale: number;
  verifiedPct: number;
  stalePct: number;
};

export type QualityReport = {
  generatedAt: string;
  countryCode: string | null;
  entities: Record<string, EntityQualityMetric>;
  issues: {
    open: number;
    acknowledged: number;
    resolvedLast7Days: number;
    bySeverity: Record<string, number>;
    byRule: Array<{ rule: string; count: number }>;
  };
  collection: {
    runsLast7Days: number;
    byStatus: Record<string, number>;
    lastRunAt: string | null;
    lastFailureAt: string | null;
  };
  provenance: {
    dataSources: number;
    verifiedSources: number;
    entitiesWithMultipleSources: number;
    offersWithoutSource: number;
  };
};

function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function toMetric(
  entityType: string,
  policyKey: FreshnessPolicyKey,
  rows: Array<{
    verificationStatus: string;
    lastVerifiedAt: Date | null;
  }>,
  now: Date
): EntityQualityMetric {
  const policy = getFreshnessPolicy(policyKey);
  const cutoff = staleCutoff(policy, now);
  let verified = 0;
  let unverified = 0;
  let needsReview = 0;
  let rejected = 0;
  let neverVerified = 0;
  let stale = 0;
  for (const row of rows) {
    if (row.verificationStatus === "VERIFIED") verified++;
    else if (row.verificationStatus === "NEEDS_REVIEW") needsReview++;
    else if (row.verificationStatus === "REJECTED") rejected++;
    else unverified++;
    if (!row.lastVerifiedAt) neverVerified++;
    else if (row.lastVerifiedAt < cutoff) stale++;
  }
  return {
    entityType,
    label: policy.label,
    total: rows.length,
    verified,
    unverified,
    needsReview,
    rejected,
    neverVerified,
    stale,
    verifiedPct: pct(verified, rows.length),
    stalePct: pct(stale + neverVerified, rows.length),
  };
}

/**
 * Relatório agregado de qualidade. Não retorna dados pessoais nem conteúdo
 * sensível; serve para CLI, endpoint interno e acompanhamento de tendência.
 */
export async function getQualityReport(
  prisma: PrismaClient,
  options: { now?: Date; countryCode?: string } = {}
): Promise<QualityReport> {
  const now = options.now ?? new Date();
  const countryCode = options.countryCode ?? null;
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3_600_000);

  const offerWhere = countryCode ? { countryCode } : {};

  const [
    platforms,
    plans,
    offers,
    contents,
    availability,
    platformCountries,
    issuesOpen,
    issuesAcknowledged,
    issuesResolved,
    issuesBySeverity,
    issuesByRule,
    runs,
    lastRun,
    lastFailure,
    dataSources,
    verifiedSources,
    multiSource,
    offersWithoutSource,
  ] = await Promise.all([
    prisma.platform.findMany({
      select: { verificationStatus: true, lastVerifiedAt: true },
    }),
    prisma.plan.findMany({
      select: { verificationStatus: true, lastVerifiedAt: true },
    }),
    prisma.planOffer.findMany({
      where: offerWhere,
      select: { verificationStatus: true, lastVerifiedAt: true },
    }),
    prisma.content.findMany({
      select: { verificationStatus: true, lastVerifiedAt: true },
    }),
    prisma.contentAvailability.findMany({
      select: { verificationStatus: true, lastVerifiedAt: true },
    }),
    prisma.platformCountry.findMany({
      select: { verificationStatus: true, lastVerifiedAt: true },
    }),
    prisma.dataQualityIssue.count({ where: { status: "OPEN" } }),
    prisma.dataQualityIssue.count({ where: { status: "ACKNOWLEDGED" } }),
    prisma.dataQualityIssue.count({
      where: { status: "RESOLVED", resolvedAt: { gte: sevenDaysAgo } },
    }),
    prisma.dataQualityIssue.groupBy({
      by: ["severity"],
      where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      _count: { _all: true },
    }),
    prisma.dataQualityIssue.groupBy({
      by: ["rule"],
      where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      _count: { _all: true },
      orderBy: { _count: { rule: "desc" } },
      take: 20,
    }),
    prisma.scrapeRun.groupBy({
      by: ["status"],
      where: { startedAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
    }),
    prisma.scrapeRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
    prisma.scrapeRun.findFirst({
      where: { status: "FAILED" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
    prisma.dataSource.count(),
    prisma.dataSource.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.dataSource.groupBy({
      by: ["entityType", "entityId"],
      _count: { _all: true },
      having: { entityId: { _count: { gt: 1 } } },
    }),
    prisma.planOffer.count({
      where: { ...offerWhere, OR: [{ sourceUrl: null }, { sourceUrl: "" }] },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of runs) {
    byStatus[row.status] = row._count._all;
  }
  const bySeverity: Record<string, number> = {};
  for (const row of issuesBySeverity) {
    bySeverity[row.severity] = row._count._all;
  }

  const entities: Record<string, EntityQualityMetric> = {
    platforms: toMetric("PLATFORM", "platform", platforms, now),
    plans: toMetric("PLAN", "offer", plans, now),
    offers: toMetric("PLAN_OFFER", "offer", offers, now),
    contents: toMetric("CONTENT", "content", contents, now),
    availability: toMetric(
      "CONTENT_AVAILABILITY",
      "availability",
      availability,
      now
    ),
    platformCountries: toMetric(
      "PLATFORM_COUNTRY",
      "platform-country",
      platformCountries,
      now
    ),
  };

  return {
    generatedAt: now.toISOString(),
    countryCode,
    entities,
    issues: {
      open: issuesOpen,
      acknowledged: issuesAcknowledged,
      resolvedLast7Days: issuesResolved,
      bySeverity,
      byRule: issuesByRule.map((row) => ({
        rule: row.rule,
        count: row._count._all,
      })),
    },
    collection: {
      runsLast7Days: runs.reduce((sum, row) => sum + row._count._all, 0),
      byStatus,
      lastRunAt: lastRun?.startedAt.toISOString() ?? null,
      lastFailureAt: lastFailure?.startedAt.toISOString() ?? null,
    },
    provenance: {
      dataSources,
      verifiedSources,
      entitiesWithMultipleSources: multiSource.length,
      offersWithoutSource,
    },
  };
}

/** Formata o relatório para o CLI, sem inventar dados ausentes. */
export function formatQualityReport(report: QualityReport): string {
  const lines: string[] = [];
  lines.push("=== Qualidade dos dados ===");
  lines.push(
    `Gerado em: ${report.generatedAt}${report.countryCode ? ` · país ${report.countryCode}` : ""}`
  );
  lines.push("");
  lines.push(
    "Entidade".padEnd(24) +
      "Total".padStart(7) +
      "Verif.".padStart(9) +
      "%".padStart(7) +
      "Sem verif.".padStart(11) +
      "Revisão".padStart(9) +
      "Desatual.".padStart(10)
  );
  for (const metric of Object.values(report.entities)) {
    lines.push(
      metric.entityType.padEnd(24) +
        String(metric.total).padStart(7) +
        String(metric.verified).padStart(9) +
        String(metric.verifiedPct).padStart(7) +
        String(metric.unverified).padStart(11) +
        String(metric.needsReview).padStart(9) +
        String(metric.stale + metric.neverVerified).padStart(10)
    );
  }
  lines.push("");
  lines.push(
    `Problemas abertos: ${report.issues.open} · reconhecidos: ${report.issues.acknowledged} · resolvidos (7d): ${report.issues.resolvedLast7Days}`
  );
  if (report.issues.byRule.length > 0) {
    lines.push("Por regra:");
    for (const row of report.issues.byRule) {
      lines.push(`  ${row.rule}: ${row.count}`);
    }
  }
  lines.push("");
  lines.push(
    `Coletas (7d): ${report.collection.runsLast7Days} · última: ${report.collection.lastRunAt ?? "nunca"} · última falha: ${report.collection.lastFailureAt ?? "nenhuma"}`
  );
  lines.push(
    `Proveniência: ${report.provenance.dataSources} fontes (${report.provenance.verifiedSources} verificadas) · ${report.provenance.entitiesWithMultipleSources} registros com múltiplas fontes · ${report.provenance.offersWithoutSource} ofertas sem URL`
  );
  const freshness = FRESHNESS_POLICIES.map(
    (policy) => `${policy.key}=${policy.maxAgeHours}h`
  ).join(", ");
  lines.push(`Políticas de atualização: ${freshness}`);
  lines.push(
    `Severidades monitoradas: ${ISSUE_SEVERITIES.join(", ")}`
  );
  return lines.join("\n");
}

/**
 * Descreve a confiança de uma oferta para a UI. Nunca transforma ausência de
 * verificação em "atualizado".
 */
export function describeOfferTrust(
  offer: {
    verificationStatus: string;
    lastVerifiedAt: Date | null;
    lastCheckedAt: Date | null;
  },
  now: Date = new Date()
): {
  freshness: FreshnessEvaluation;
  verified: boolean;
  label: "verified" | "stale" | "due-soon" | "unverified";
} {
  const freshness = evaluateFreshness(
    offer.lastVerifiedAt,
    getFreshnessPolicy("offer"),
    now
  );
  if (offer.verificationStatus !== "VERIFIED") {
    return { freshness, verified: false, label: "unverified" };
  }
  if (freshness.state === "STALE" || freshness.state === "NEVER_VERIFIED") {
    return { freshness, verified: true, label: "stale" };
  }
  if (freshness.state === "DUE_SOON") {
    return { freshness, verified: true, label: "due-soon" };
  }
  return { freshness, verified: true, label: "verified" };
}
