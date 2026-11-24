import {
  COLLECTION_METHOD,
  VERIFICATION_STATUS,
  type EntityType,
  type VerificationStatus,
} from "./constants";
import { sha256Hex } from "./normalize";
import type { DataSourceDb } from "./types";
import type { NormalizedProvenance } from "./validation";

export type ProvenanceFields = {
  source: string | null;
  sourceUrl: string | null;
  collectionMethod: string | null;
  collectedAt: Date | null;
  lastVerifiedAt: Date | null;
  verificationStatus: VerificationStatus;
};

/** Campos prontos para gravar em qualquer entidade com proveniência. */
export function provenanceFields(
  provenance: NormalizedProvenance
): ProvenanceFields {
  return {
    source: provenance.source,
    sourceUrl: provenance.sourceUrl,
    collectionMethod: provenance.collectionMethod,
    collectedAt: provenance.collectedAt,
    lastVerifiedAt: provenance.lastVerifiedAt,
    verificationStatus: provenance.verificationStatus,
  };
}

export type DataSourceInput = {
  entityType: EntityType;
  entityId: string;
  source: string | null;
  sourceUrl?: string | null;
  collectionMethod: string | null;
  collectedAt: Date | string | null;
  lastVerifiedAt?: Date | string | null;
  verificationStatus: VerificationStatus;
  isPrimary?: boolean;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latest(
  current: Date | null | undefined,
  incoming: Date | null
): Date | null {
  if (!current) return incoming;
  if (!incoming) return current;
  return incoming > current ? incoming : current;
}

function mergeVerificationStatus(
  current: VerificationStatus,
  incoming: VerificationStatus
): VerificationStatus {
  if (incoming === VERIFICATION_STATUS.VERIFIED) return incoming;
  if (incoming === VERIFICATION_STATUS.NEEDS_REVIEW) return incoming;
  if (incoming === VERIFICATION_STATUS.REJECTED) return incoming;
  // Um registro já verificado não é rebaixado só porque uma coleta posterior
  // veio sem evidência de verificação.
  if (current === VERIFICATION_STATUS.VERIFIED) return current;
  return incoming;
}

/**
 * Registra uma fonte sem apagar as anteriores. A mesma fonte (source+URL) é
 * atualizada; fontes distintas coexistem. `isPrimary` marca a fonte corrente.
 * Retorna null quando não há origem identificável — não inventamos uma.
 */
export async function upsertDataSource(
  db: DataSourceDb,
  input: DataSourceInput
): Promise<unknown | null> {
  const source = input.source?.trim();
  if (!source) return null;

  const collectedAt = toDate(input.collectedAt);
  if (!collectedAt) return null; // DataSource exige data de coleta real.

  const sourceUrl = input.sourceUrl?.trim() || null;
  const collectionMethod = input.collectionMethod ?? COLLECTION_METHOD.LEGACY;
  const dedupeKey = `${input.entityType}:${input.entityId}:${sha256Hex(
    `${source}|${sourceUrl ?? ""}`
  )}`;
  const isPrimary = input.isPrimary ?? true;

  const existing = await db.dataSource.findUnique({ where: { dedupeKey } });
  if (existing) {
    if (isPrimary) {
      await db.dataSource.updateMany({
        where: {
          entityType: input.entityType,
          entityId: input.entityId,
          isPrimary: true,
          NOT: { dedupeKey },
        },
        data: { isPrimary: false },
      });
    }
    return db.dataSource.update({
      where: { dedupeKey },
      data: {
        sourceUrl: sourceUrl ?? existing.sourceUrl,
        collectionMethod,
        collectedAt: latest(existing.collectedAt, collectedAt) ?? collectedAt,
        lastVerifiedAt: latest(
          existing.lastVerifiedAt,
          toDate(input.lastVerifiedAt)
        ),
        verificationStatus: mergeVerificationStatus(
          existing.verificationStatus as VerificationStatus,
          input.verificationStatus
        ),
        isPrimary,
      },
    });
  }

  if (isPrimary) {
    await db.dataSource.updateMany({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        isPrimary: true,
      },
      data: { isPrimary: false },
    });
  }

  return db.dataSource.create({
    data: {
      dedupeKey,
      entityType: input.entityType,
      entityId: input.entityId,
      source,
      sourceUrl,
      collectionMethod,
      collectedAt,
      lastVerifiedAt: toDate(input.lastVerifiedAt),
      verificationStatus: input.verificationStatus,
      isPrimary,
    },
  });
}

export function provenanceFromSource(input: {
  source: string;
  sourceUrl?: string | null;
  collectionMethod: string;
  collectedAt: Date;
  lastVerifiedAt?: Date | null;
  verificationStatus?: VerificationStatus;
}): NormalizedProvenance {
  return {
    source: input.source.trim() || null,
    sourceUrl: input.sourceUrl?.trim() || null,
    collectionMethod: input.collectionMethod.trim()
      ? (input.collectionMethod as NormalizedProvenance["collectionMethod"])
      : null,
    collectedAt: input.collectedAt,
    lastVerifiedAt: input.lastVerifiedAt ?? null,
    verificationStatus:
      input.verificationStatus ?? VERIFICATION_STATUS.UNVERIFIED,
  };
}
