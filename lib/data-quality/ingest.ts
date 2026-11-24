import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import {
  auditTypeForField,
  diffFields,
  writeAuditEvent,
  writeCreationAudit,
} from "./audit";
import {
  COLLECTION_METHOD,
  VERIFICATION_STATUS,
  type EntityType,
  type VerificationStatus,
} from "./constants";
import { provenanceFields, upsertDataSource } from "./provenance";
import {
  assertValid,
  DataQualityValidationError,
  validateCollectionRunInput,
  validateContentInput,
  validateOfferInput,
  validatePlanInput,
  type CollectionRunInput,
  type ContentInput,
  type OfferInput,
  type ValidationIssue,
} from "./validation";
import { formatMoney } from "@/lib/money";
import { defaultCountry, isCountry } from "@/lib/countries";

/**
 * Entrada de ingestão de oferta. A plataforma pode ser identificada por id ou
 * slug; o plano por id, tierKey ou nome. O restante é validado por
 * validateOfferInput.
 */
export type OfferIngestInput = OfferInput & {
  platformId?: string | null;
  platformSlug?: string | null;
  planId?: string | null;
  tierKey?: string | null;
  planName?: string | null;
};

export type ApplyOfferOptions = {
  /** Nome do processo/script que originou a escrita (auditoria). */
  process: string;
  actor?: string;
  /** Cria o plano quando não existir. */
  createPlan?: boolean;
  /** Não grava nada; valida e calcula o resultado. */
  dryRun?: boolean;
  now?: Date;
};

export type ApplyOfferStatus = "created" | "updated" | "unchanged";

export type ApplyOfferResult = {
  status: ApplyOfferStatus;
  offerId: string | null;
  planId: string | null;
  platformId: string;
  priceChanged: boolean;
  historyRecorded: boolean;
  updateApplied: boolean;
  changes: string[];
  warnings: string[];
  validationIssues: ValidationIssue[];
};

type OfferSnapshot = Prisma.PlanOfferGetPayload<{
  include: { history: { orderBy: { recordedAt: "desc" }; take: 1 } };
}>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

/** Campo textual só é sobrescrito quando a entrada traz valor. */
function keepWhenEmpty(
  incoming: string | null,
  existing: string | null | undefined
): string | null {
  return incoming !== null && incoming !== ""
    ? incoming
    : existing ?? null;
}

async function resolvePlatform(
  db: Prisma.TransactionClient,
  input: OfferIngestInput
) {
  if (hasValue(input.platformId)) {
    return db.platform.findUnique({ where: { id: String(input.platformId) } });
  }
  if (hasValue(input.platformSlug)) {
    return db.platform.findUnique({
      where: { slug: String(input.platformSlug).trim() },
    });
  }
  return null;
}

async function resolvePlan(
  db: Prisma.TransactionClient,
  platformId: string,
  input: OfferIngestInput
) {
  if (hasValue(input.planId)) {
    return db.plan.findUnique({ where: { id: String(input.planId) } });
  }
  if (hasValue(input.tierKey)) {
    return db.plan.findFirst({
      where: { platformId, tierKey: String(input.tierKey).trim() },
    });
  }
  if (hasValue(input.planName)) {
    return db.plan.findFirst({
      where: { platformId, name: String(input.planName).trim() },
    });
  }
  return null;
}

/**
 * Aplica uma oferta de forma transacional e idempotente.
 *
 * Regras de proteção:
 * - validação com erro bloqueia a escrita inteira;
 * - entrada sem valor de preço válido nunca sobrescreve o preço atual;
 * - uma coleta não verificada não substitui um registro VERIFIED;
 * - campos ausentes preservam o valor existente;
 * - histórico só recebe uma linha quando o preço/moeda realmente muda;
 * - toda escrita gera ChangeLog e DataSource.
 */
export async function applyOffer(
  prisma: PrismaClient,
  input: OfferIngestInput,
  options: ApplyOfferOptions
): Promise<ApplyOfferResult> {
  const now = options.now ?? new Date();
  const validation = validateOfferInput(input, {
    now,
    requireProvenance: true,
  });
  assertValid(validation, "Oferta");
  const offer = validation.value;
  const amount = offer.amount;
  if (amount === null) {
    throw new DataQualityValidationError("Oferta", [
      {
        field: "amount",
        code: "INVALID_AMOUNT",
        message: "valor da oferta é obrigatório",
        severity: "ERROR",
      },
    ]);
  }

  const warnings = validation.issues
    .filter((issue) => issue.severity === "WARNING")
    .map((issue) => `${issue.field}: ${issue.message}`);

  return prisma.$transaction(async (tx) => {
    const platform = await resolvePlatform(tx, input);
    if (!platform) {
      throw new DataQualityValidationError("Oferta", [
        {
          field: "platformId",
          code: "PLATFORM_NOT_FOUND",
          message: "plataforma não encontrada por id nem por slug",
          severity: "ERROR",
        },
      ]);
    }

    let plan = await resolvePlan(tx, platform.id, input);
    if (plan && plan.platformId !== platform.id) {
      throw new DataQualityValidationError("Oferta", [
        {
          field: "planId",
          code: "PLAN_PLATFORM_MISMATCH",
          message: "o plano informado pertence a outra plataforma",
          severity: "ERROR",
        },
      ]);
    }

    let planCreated = false;
    if (!plan) {
      if (options.createPlan === false) {
        throw new DataQualityValidationError("Oferta", [
          {
            field: "planId",
            code: "PLAN_NOT_FOUND",
            message: "plano não encontrado e criação desabilitada",
            severity: "ERROR",
          },
        ]);
      }
      const planName =
        String(input.planName ?? input.displayName ?? "").trim() ||
        String(input.tierKey ?? "").trim();
      if (!planName) {
        throw new DataQualityValidationError("Oferta", [
          {
            field: "planName",
            code: "PLAN_NAME_REQUIRED",
            message: "plano não informado nem derivável de displayName/tierKey",
            severity: "ERROR",
          },
        ]);
      }
      const planValidation = validatePlanInput(
        {
          platformId: platform.id,
          tierKey: input.tierKey ?? planName,
          name: planName,
          ...provenanceFields(offer.provenance),
        },
        { now, requireProvenance: true }
      );
      assertValid(planValidation, "Plano");
      if (options.dryRun) {
        return {
          status: "created" as const,
          offerId: null,
          planId: null,
          platformId: platform.id,
          priceChanged: true,
          historyRecorded: false,
          updateApplied: false,
          changes: [],
          warnings,
          validationIssues: validation.issues,
        };
      }
      plan = await tx.plan.create({
        data: {
          platformId: platform.id,
          tierKey: planValidation.value.tierKey,
          name: planValidation.value.name,
          ...provenanceFields(planValidation.value.provenance),
        },
      });
      planCreated = true;
      await upsertDataSource(tx, {
        entityType: "PLAN",
        entityId: plan.id,
        source: planValidation.value.provenance.source,
        sourceUrl: planValidation.value.provenance.sourceUrl,
        collectionMethod: planValidation.value.provenance.collectionMethod,
        collectedAt:
          planValidation.value.provenance.collectedAt ?? now,
        lastVerifiedAt: planValidation.value.provenance.lastVerifiedAt,
        verificationStatus: planValidation.value.provenance.verificationStatus,
        isPrimary: true,
      });
      await writeCreationAudit(
        tx,
        {
          type: "PLAN_CHANGE",
          entityType: "PLAN",
          entityId: plan.id,
          description: `Plano "${plan.name}" criado para ${platform.name}`,
          platformId: platform.id,
          source: planValidation.value.provenance.source,
          process: options.process,
          actor: options.actor ?? null,
        },
        {
          name: plan.name,
          tierKey: plan.tierKey,
          platformId: platform.id,
        }
      );
    }

    const existing: OfferSnapshot | null = await tx.planOffer.findUnique({
      where: {
        planId_countryCode_billingCycle: {
          planId: plan.id,
          countryCode: offer.countryCode,
          billingCycle: offer.billingCycle ?? "MONTHLY",
        },
      },
      include: { history: { orderBy: { recordedAt: "desc" }, take: 1 } },
    });

    const incomingVerified =
      offer.provenance.verificationStatus === VERIFICATION_STATUS.VERIFIED;
    const existingVerified =
      existing?.verificationStatus === VERIFICATION_STATUS.VERIFIED;
    const allowPriceWrite = !existingVerified || incomingVerified;

    const latestHistory = existing?.history[0];
    const previousAmount = Number(latestHistory?.amount ?? existing?.amount ?? 0);
    const previousCurrency = latestHistory?.currency ?? existing?.currency ?? offer.currency;
    const priceChanged =
      Boolean(existing) &&
      (Math.abs(previousAmount - amount) > 0.005 ||
        previousCurrency !== offer.currency);
    const needsHistory = Boolean(existing) && !latestHistory;
    const historyRecorded = allowPriceWrite && (priceChanged || needsHistory);

    const verificationStatus = incomingVerified
      ? VERIFICATION_STATUS.VERIFIED
      : existingVerified
        ? VERIFICATION_STATUS.VERIFIED
        : offer.provenance.verificationStatus;
    const lastVerifiedAt = incomingVerified
      ? offer.provenance.lastVerifiedAt
      : existing?.lastVerifiedAt ?? null;
    const collectedAt = allowPriceWrite
      ? offer.provenance.collectedAt ?? now
      : existing?.collectedAt ?? null;
    const sourceUrl = allowPriceWrite
      ? keepWhenEmpty(offer.provenance.sourceUrl, existing?.sourceUrl)
      : existing?.sourceUrl ?? null;
    const sourceType = allowPriceWrite
      ? offer.sourceType ?? existing?.sourceType ?? "MANUAL"
      : existing?.sourceType ?? "MANUAL";

    if (!allowPriceWrite) {
      warnings.push(
        "PRICE_PRESERVED: coleta não verificada não substitui preço já verificado"
      );
    }

    const eligibleForPrice = allowPriceWrite;
    const updateData: Prisma.PlanOfferUncheckedUpdateInput = {
      ...(eligibleForPrice
        ? {
            amount,
            currency: offer.currency,
            ...(hasValue(input.taxIncluded)
              ? { taxIncluded: offer.taxIncluded }
              : {}),
          }
        : {}),
      ...(hasValue(input.billingMonths) || !existing
        ? { billingMonths: offer.billingMonths }
        : {}),
      // Metadados só acompanham a escrita quando o preço pode ser atualizado:
      // uma coleta não verificada não reescreve metadados de um registro
      // verificado.
      ...(allowPriceWrite && offer.displayName !== null
        ? { displayName: offer.displayName }
        : {}),
      ...(allowPriceWrite && offer.quality !== null
        ? { quality: offer.quality }
        : {}),
      ...(allowPriceWrite && hasValue(input.ads) ? { ads: offer.ads } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      sourceType,
      ...(hasValue(input.status) ? { status: offer.status } : {}),
      ...(offer.provenance.collectionMethod !== null
        ? { collectionMethod: offer.provenance.collectionMethod }
        : {}),
      verificationStatus,
      collectedAt,
      lastVerifiedAt,
      // `lastCheckedAt` só avança quando a coleta informa explicitamente que
      // consultou a fonte. O seed não é uma consulta.
      ...(offer.lastCheckedAt !== null
        ? { lastCheckedAt: offer.lastCheckedAt }
        : {}),
      ...(incomingVerified
        ? {
            lastSuccessAt:
              offer.provenance.lastVerifiedAt ?? offer.lastCheckedAt ?? now,
          }
        : {}),
    };

    if (options.dryRun) {
      return {
        status: existing
          ? priceChanged || needsHistory || planCreated
            ? ("updated" as const)
            : ("unchanged" as const)
          : ("created" as const),
        offerId: existing?.id ?? null,
        planId: plan.id,
        platformId: platform.id,
        priceChanged,
        historyRecorded: false,
        updateApplied: false,
        changes: [],
        warnings,
        validationIssues: validation.issues,
      };
    }

    let offerId: string;
    let changes: string[] = [];

    if (!existing) {
      const created = await tx.planOffer.create({
        data: {
          planId: plan.id,
          countryCode: offer.countryCode,
          currency: offer.currency,
          amount,
          billingCycle: offer.billingCycle ?? "MONTHLY",
          billingMonths: offer.billingMonths,
          taxIncluded: offer.taxIncluded,
          displayName: offer.displayName,
          quality: offer.quality,
          ads: offer.ads,
          sourceUrl: offer.provenance.sourceUrl,
          sourceType,
          collectionMethod: offer.provenance.collectionMethod,
          status: offer.status,
          verificationStatus,
          collectedAt: offer.provenance.collectedAt ?? now,
          lastVerifiedAt: offer.provenance.lastVerifiedAt,
          lastCheckedAt: offer.lastCheckedAt ?? now,
          lastSuccessAt: incomingVerified
            ? offer.provenance.lastVerifiedAt ?? offer.lastCheckedAt ?? now
            : null,
        },
      });
      offerId = created.id;

      await tx.priceHistory.create({
        data: {
          offerId,
          amount,
          currency: offer.currency,
          taxIncluded: offer.taxIncluded,
          sourceType,
          sourceUrl: offer.provenance.sourceUrl,
          verificationStatus,
          collectedAt: offer.provenance.collectedAt ?? now,
          recordedAt: offer.provenance.lastVerifiedAt ?? now,
        },
      });

      await writeCreationAudit(
        tx,
        {
          type: "PLAN_CHANGE",
          entityType: "PLAN_OFFER",
          entityId: offerId,
          description: `${platform.name} (${offer.countryCode}): nova oferta "${offer.displayName ?? plan.name}" por ${formatMoney(amount, offer.currency, "pt-BR")}`,
          platformId: platform.id,
          contentId: null,
          countryCode: offer.countryCode,
          currency: offer.currency,
          source: offer.provenance.source,
          process: options.process,
          actor: options.actor ?? null,
        },
        {
          planId: plan.id,
          countryCode: offer.countryCode,
          amount,
          currency: offer.currency,
          billingCycle: offer.billingCycle,
          sourceType,
          verificationStatus,
        }
      );
      changes = ["created"];
    } else {
      offerId = existing.id;
      const changedFields = diffFields(
        existing as unknown as Record<string, unknown>,
        updateData as Record<string, unknown>
      );
      if (changedFields.length > 0) {
        await tx.planOffer.update({
          where: { id: existing.id },
          data: updateData,
        });
        for (const change of changedFields) {
          await writeAuditEvent(tx, {
            type: auditTypeForField(change.field),
            entityType: "PLAN_OFFER",
            entityId: existing.id,
            field: change.field,
            description: `${platform.name} (${offer.countryCode}): ${offer.displayName ?? plan.name} — ${change.field} alterado`,
            platformId: platform.id,
            countryCode: offer.countryCode,
            currency: offer.currency,
            source: offer.provenance.source,
            process: options.process,
            actor: options.actor ?? null,
            oldValue: change.oldValue,
            newValue: change.newValue,
          });
          changes.push(change.field);
        }
      } else {
        // Mesmo sem alteração de valor, registra que a oferta foi checada.
        await tx.planOffer.update({
          where: { id: existing.id },
          data: { lastCheckedAt: offer.lastCheckedAt ?? now },
        });
      }
    }

    if (historyRecorded) {
      await tx.priceHistory.create({
        data: {
          offerId,
          amount,
          currency: offer.currency,
          taxIncluded: offer.taxIncluded,
          sourceType,
          sourceUrl: offer.provenance.sourceUrl,
          verificationStatus,
          collectedAt: offer.provenance.collectedAt ?? now,
          recordedAt: offer.provenance.lastVerifiedAt ?? now,
        },
      });
      if (priceChanged) {
        await writeAuditEvent(tx, {
          type: "PRICE_CHANGE",
          entityType: "PLAN_OFFER",
          entityId: offerId,
          field: "amount",
          description: `${platform.name} (${offer.countryCode}): ${offer.displayName ?? plan.name} mudou de ${formatMoney(previousAmount, previousCurrency, "pt-BR")} para ${formatMoney(amount, offer.currency, "pt-BR")}`,
          platformId: platform.id,
          countryCode: offer.countryCode,
          currency: offer.currency,
          source: offer.provenance.source,
          process: options.process,
          actor: options.actor ?? null,
          oldValue: previousAmount,
          newValue: amount,
        });
        changes.push("priceHistory");
      }
    }

    await upsertDataSource(tx, {
      entityType: "PLAN_OFFER",
      entityId: offerId,
      source: offer.provenance.source ?? sourceType,
      sourceUrl: offer.provenance.sourceUrl,
      collectionMethod: offer.provenance.collectionMethod,
      collectedAt: offer.provenance.collectedAt ?? now,
      lastVerifiedAt: offer.provenance.lastVerifiedAt,
      verificationStatus: offer.provenance.verificationStatus,
      isPrimary: true,
    });

    // Uma oferta é evidência de operação no país. Nunca sobrescreve
    // NOT_AVAILABLE: o conflito fica para revisão.
    const platformCountry = await tx.platformCountry.findUnique({
      where: {
        platformId_countryCode: {
          platformId: platform.id,
          countryCode: offer.countryCode,
        },
      },
    });
    if (!platformCountry) {
      await tx.platformCountry.create({
        data: {
          platformId: platform.id,
          countryCode: offer.countryCode,
          status: "OPERATES",
          ...provenanceFields(offer.provenance),
        },
      });
    } else if (platformCountry.status !== "NOT_AVAILABLE") {
      const countryChanges = diffFields(
        platformCountry as unknown as Record<string, unknown>,
        {
          status: "OPERATES",
          ...provenanceFields(offer.provenance),
        }
      );
      if (countryChanges.length > 0) {
        await tx.platformCountry.update({
          where: {
            platformId_countryCode: {
              platformId: platform.id,
              countryCode: offer.countryCode,
            },
          },
          data: {
            status: "OPERATES",
            ...provenanceFields(offer.provenance),
          },
        });
      }
    } else {
      warnings.push(
        "COUNTRY_CONFLICT: oferta existe, mas PlatformCountry está NOT_AVAILABLE"
      );
    }

    const status: ApplyOfferStatus = !existing
      ? "created"
      : changes.length > 0 || planCreated
        ? "updated"
        : "unchanged";

    return {
      status,
      offerId,
      planId: plan.id,
      platformId: platform.id,
      priceChanged,
      historyRecorded,
      updateApplied: true,
      changes,
      warnings,
      validationIssues: validation.issues,
    };
  });
}

/** Abre uma execução de coleta com status RUNNING. Retorna o id do log. */
export async function startCollectionRun(
  prisma: PrismaClient,
  input: CollectionRunInput
): Promise<string> {
  const now = new Date();
  const validation = validateCollectionRunInput(
    { ...input, status: "RUNNING", startedAt: input.startedAt ?? now },
    { now }
  );
  const run = assertValid(validation, "Execução de coleta");
  const created = await prisma.scrapeRun.create({
    data: {
      kind: run.kind,
      platformId: run.platformId,
      countryCode: run.countryCode,
      source: run.source,
      status: "RUNNING",
      httpStatus: run.httpStatus,
      offersFound: run.offersFound,
      recordsCreated: run.recordsCreated,
      recordsUpdated: run.recordsUpdated,
      recordsUnchanged: run.recordsUnchanged,
      recordsFailed: run.recordsFailed,
      errorCode: run.errorCode,
      error: run.error,
      startedAt: run.startedAt,
      finishedAt: null,
    },
  });
  return created.id;
}

/** Finaliza uma execução; nunca altera os dados coletados. */
export async function finishCollectionRun(
  prisma: PrismaClient,
  runId: string,
  input: Omit<CollectionRunInput, "startedAt"> & {
    status: string;
    finishedAt?: Date;
  }
): Promise<boolean> {
  const existing = await prisma.scrapeRun.findUnique({
    where: { id: runId },
    select: { startedAt: true },
  });
  if (!existing) return false;
  const now = new Date();
  const validation = validateCollectionRunInput(
    { ...input, startedAt: existing.startedAt, finishedAt: input.finishedAt ?? now },
    { now }
  );
  const run = assertValid(validation, "Execução de coleta");
  await prisma.scrapeRun.update({
    where: { id: runId },
    data: {
      status: run.status,
      httpStatus: run.httpStatus,
      offersFound: run.offersFound,
      recordsCreated: run.recordsCreated,
      recordsUpdated: run.recordsUpdated,
      recordsUnchanged: run.recordsUnchanged,
      recordsFailed: run.recordsFailed,
      errorCode: run.errorCode,
      error: run.error,
      finishedAt: run.finishedAt,
    },
  });
  return true;
}

/**
 * Registra uma checagem malsucedida sem tocar em preço, lastVerifiedAt ou
 * lastSuccessAt. O último dado válido permanece intacto.
 */
export async function recordOfferCheckFailure(
  prisma: PrismaClient,
  input: {
    offerId: string;
    checkedAt?: Date;
    error?: string | null;
  }
): Promise<boolean> {
  const checkedAt = input.checkedAt ?? new Date();
  const offer = await prisma.planOffer.findUnique({
    where: { id: input.offerId },
    select: { id: true },
  });
  if (!offer) return false;
  await prisma.planOffer.update({
    where: { id: offer.id },
    data: {
      lastCheckedAt: checkedAt,
      // O preço e a última verificação ficam intocados.
    },
  });
  if (input.error) {
    await writeAuditEvent(prisma, {
      type: "COLLECTION_FAILED",
      entityType: "PLAN_OFFER",
      entityId: offer.id,
      description: `Falha ao checar oferta: ${errorMessage(input.error)}`,
      process: "recordOfferCheckFailure",
      metadata: { checkedAt: checkedAt.toISOString() },
    });
  }
  return true;
}

export type MarkContentAvailabilityInput = {
  contentId: string;
  platformId: string;
  countryCode: string;
  available: boolean;
  source?: string | null;
  sourceUrl?: string | null;
  collectionMethod?: string | null;
  collectedAt?: Date | null;
  lastVerifiedAt?: Date | null;
  verificationStatus?: VerificationStatus;
  process: string;
  actor?: string;
};

/**
 * Marca/atualiza disponibilidade sem apagar o histórico: uma remoção vira
 * `available=false` + `removedAt`, nunca DELETE. Reativar limpa `removedAt`.
 */
export async function applyContentAvailability(
  prisma: PrismaClient,
  input: MarkContentAvailabilityInput
): Promise<{ created: boolean; changed: boolean; id: string }> {
  const now = new Date();
  const verificationStatus =
    input.verificationStatus ?? VERIFICATION_STATUS.UNVERIFIED;
  const collectedAt = input.collectedAt ?? now;
  const lastVerifiedAt =
    verificationStatus === VERIFICATION_STATUS.VERIFIED
      ? input.lastVerifiedAt ?? now
      : null;
  const method = input.collectionMethod ?? COLLECTION_METHOD.MANUAL;
  const source = input.source ?? method;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.contentAvailability.findUnique({
      where: {
        contentId_platformId_countryCode: {
          contentId: input.contentId,
          platformId: input.platformId,
          countryCode: input.countryCode,
        },
      },
    });

    if (!existing) {
      const created = await tx.contentAvailability.create({
        data: {
          contentId: input.contentId,
          platformId: input.platformId,
          countryCode: input.countryCode,
          available: input.available,
          addedAt: now,
          removedAt: input.available ? null : now,
          source,
          sourceUrl: input.sourceUrl ?? null,
          collectionMethod: method,
          collectedAt,
          lastVerifiedAt,
          verificationStatus,
        },
      });
      await upsertDataSource(tx, {
        entityType: "CONTENT_AVAILABILITY",
        entityId: created.id,
        source,
        sourceUrl: input.sourceUrl ?? null,
        collectionMethod: method,
        collectedAt,
        lastVerifiedAt,
        verificationStatus,
        isPrimary: true,
      });
      await writeCreationAudit(
        tx,
        {
          type: "AVAILABILITY_CHANGE",
          entityType: "CONTENT_AVAILABILITY",
          entityId: created.id,
          description: `Disponibilidade criada (${input.available ? "disponível" : "indisponível"})`,
          platformId: input.platformId,
          contentId: input.contentId,
          source,
          process: input.process,
          actor: input.actor ?? null,
        },
        { available: input.available }
      );
      return { created: true, changed: true, id: created.id };
    }

    const changed = existing.available !== input.available;
    if (!changed) {
      await tx.contentAvailability.update({
        where: { id: existing.id },
        data: {
          lastVerifiedAt: lastVerifiedAt ?? existing.lastVerifiedAt,
          verificationStatus:
            verificationStatus === VERIFICATION_STATUS.VERIFIED
              ? verificationStatus
              : (existing.verificationStatus as VerificationStatus),
        },
      });
      return { created: false, changed: false, id: existing.id };
    }

    await tx.contentAvailability.update({
      where: { id: existing.id },
      data: {
        available: input.available,
        removedAt: input.available ? null : now,
        source,
        sourceUrl: input.sourceUrl ?? existing.sourceUrl,
        collectionMethod: method,
        collectedAt,
        lastVerifiedAt,
        verificationStatus,
      },
    });
    await upsertDataSource(tx, {
      entityType: "CONTENT_AVAILABILITY",
      entityId: existing.id,
      source,
      sourceUrl: input.sourceUrl ?? null,
      collectionMethod: method,
      collectedAt,
      lastVerifiedAt,
      verificationStatus,
      isPrimary: true,
    });
    await writeAuditEvent(tx, {
      type: "AVAILABILITY_CHANGE",
      entityType: "CONTENT_AVAILABILITY",
      entityId: existing.id,
      field: "available",
      description: `Disponibilidade alterada para ${input.available ? "disponível" : "indisponível"}`,
      platformId: input.platformId,
      contentId: input.contentId,
      source,
      process: input.process,
      actor: input.actor ?? null,
      oldValue: existing.available,
      newValue: input.available,
    });
    return { created: false, changed: true, id: existing.id };
  });
}

export function entityTypeForOffer(): EntityType {
  return "PLAN_OFFER";
}
