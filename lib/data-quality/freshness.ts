import {
  FRESHNESS_POLICIES,
  type EntityType,
  type FreshnessPolicyKey,
} from "./constants";

export type FreshnessPolicy = (typeof FRESHNESS_POLICIES)[number];

export type FreshnessState =
  | "FRESH"
  | "DUE_SOON"
  | "STALE"
  | "NEVER_VERIFIED";

export type FreshnessEvaluation = {
  state: FreshnessState;
  policy: FreshnessPolicy;
  lastVerifiedAt: Date | null;
  ageHours: number | null;
  dueAt: Date | null;
  overdueByHours: number | null;
};

export const DUE_SOON_RATIO = 0.8;

export function getFreshnessPolicy(
  key: FreshnessPolicyKey
): FreshnessPolicy {
  const policy = FRESHNESS_POLICIES.find((item) => item.key === key);
  if (!policy) throw new Error(`Política de atualização desconhecida: ${key}`);
  return policy;
}

export function getFreshnessPolicyForEntity(
  entityType: EntityType
): FreshnessPolicy | null {
  return (
    FRESHNESS_POLICIES.find((policy) => policy.entityType === entityType) ?? null
  );
}

/**
 * Avalia a idade da última verificação. `NEVER_VERIFIED` não tem prazo: um
 * registro nunca verificado não pode ser apresentado como atual.
 */
export function evaluateFreshness(
  lastVerifiedAt: Date | string | null | undefined,
  policy: FreshnessPolicy,
  now: Date = new Date()
): FreshnessEvaluation {
  const verified =
    lastVerifiedAt instanceof Date
      ? lastVerifiedAt
      : lastVerifiedAt
        ? new Date(lastVerifiedAt)
        : null;
  if (!verified || Number.isNaN(verified.getTime())) {
    return {
      state: "NEVER_VERIFIED",
      policy,
      lastVerifiedAt: null,
      ageHours: null,
      dueAt: null,
      overdueByHours: null,
    };
  }

  const ageHours = (now.getTime() - verified.getTime()) / 3_600_000;
  const dueAt = new Date(
    verified.getTime() + policy.maxAgeHours * 3_600_000
  );

  if (ageHours >= policy.maxAgeHours) {
    return {
      state: "STALE",
      policy,
      lastVerifiedAt: verified,
      ageHours,
      dueAt,
      overdueByHours: ageHours - policy.maxAgeHours,
    };
  }

  if (ageHours >= policy.maxAgeHours * DUE_SOON_RATIO) {
    return {
      state: "DUE_SOON",
      policy,
      lastVerifiedAt: verified,
      ageHours,
      dueAt,
      overdueByHours: 0,
    };
  }

  return {
    state: "FRESH",
    policy,
    lastVerifiedAt: verified,
    ageHours,
    dueAt,
    overdueByHours: 0,
  };
}

/** Limite usado em consultas `lastVerifiedAt < cutoff`. */
export function staleCutoff(
  policy: FreshnessPolicy,
  now: Date = new Date()
): Date {
  return new Date(now.getTime() - policy.maxAgeHours * 3_600_000);
}

export function isStale(
  lastVerifiedAt: Date | string | null | undefined,
  policy: FreshnessPolicy,
  now: Date = new Date()
): boolean {
  const state = evaluateFreshness(lastVerifiedAt, policy, now).state;
  return state === "STALE" || state === "NEVER_VERIFIED";
}

export function freshnessLabel(state: FreshnessState): string {
  switch (state) {
    case "FRESH":
      return "verificado recentemente";
    case "DUE_SOON":
      return "re-verificação recomendada";
    case "STALE":
      return "desatualizado";
    case "NEVER_VERIFIED":
      return "nunca verificado";
  }
}
