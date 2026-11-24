import type { AuditDb } from "./types";
import {
  sanitizeForLog,
  stableStringify,
  truncate,
} from "./normalize";

export type AuditFieldChange = {
  field: string;
  oldValue: unknown;
  newValue: unknown;
};

export type AuditContext = {
  type: string;
  entityType: string;
  entityId: string;
  description: string;
  platformId?: string | null;
  contentId?: string | null;
  countryCode?: string | null;
  currency?: string | null;
  source?: string | null;
  process?: string | null;
  actor?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AuditEvent = AuditContext & {
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
};

function normalizeAuditValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    return Number((value as { toNumber: () => number }).toNumber());
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof (value as { toString: unknown }).toString === "function"
  ) {
    return (value as { toString: () => string }).toString();
  }
  return stableStringify(sanitizeForLog(value));
}

export function auditValuesEqual(a: unknown, b: unknown): boolean {
  const left = normalizeAuditValue(a);
  const right = normalizeAuditValue(b);
  if (left === null && right === null) return true;
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) < 1e-9;
  }
  return stableStringify(left) === stableStringify(right);
}

/**
 * Compara apenas os campos presentes em `after` (undefined = não alterar).
 * Strings com espaços extras e null/"" são equivalentes para evitar log de
 * mudanças sem significado.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: Partial<T>
): AuditFieldChange[] {
  if (!before) return [];
  const changes: AuditFieldChange[] = [];
  for (const [field, next] of Object.entries(after)) {
    if (next === undefined) continue;
    const previous = before[field as keyof T];
    if (!auditValuesEqual(previous, next)) {
      changes.push({ field, oldValue: previous, newValue: next });
    }
  }
  return changes;
}

function serializeValue(value: unknown): string | null {
  const normalized = normalizeAuditValue(value);
  if (normalized === null) return null;
  const text =
    typeof normalized === "string"
      ? normalized
      : stableStringify(normalized);
  return truncate(text, 2000);
}

function serializeMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null;
  return truncate(stableStringify(sanitizeForLog(metadata)), 4000);
}

export async function writeAuditEvent(
  db: AuditDb,
  event: AuditEvent
): Promise<unknown> {
  return db.changeLog.create({
    data: {
      type: event.type,
      entityType: event.entityType,
      entityId: event.entityId,
      field: event.field ?? null,
      description: truncate(event.description, 1000),
      platformId: event.platformId ?? null,
      contentId: event.contentId ?? null,
      countryCode: event.countryCode ?? null,
      currency: event.currency ?? null,
      oldValue: serializeValue(event.oldValue),
      newValue: serializeValue(event.newValue),
      source: event.source ?? null,
      process: event.process ?? null,
      actor: event.actor ?? null,
      metadata: serializeMetadata(event.metadata),
    },
  });
}

/** Grava uma linha por campo alterado; não grava nada se não houve mudança. */
export async function writeAuditChanges(
  db: AuditDb,
  context: AuditContext,
  changes: AuditFieldChange[]
): Promise<number> {
  let written = 0;
  for (const change of changes) {
    await writeAuditEvent(db, {
      ...context,
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      description: `${context.description} — ${change.field}: ${formatAuditValue(change.oldValue)} → ${formatAuditValue(change.newValue)}`,
    });
    written++;
  }
  return written;
}

export function formatAuditValue(value: unknown): string {
  const normalized = normalizeAuditValue(value);
  if (normalized === null) return "(vazio)";
  if (typeof normalized === "string") return normalized;
  return stableStringify(normalized);
}

export function auditTypeForField(field: string): string {
  if (
    field === "amount" ||
    field === "currency" ||
    field === "taxIncluded" ||
    field === "billingCycle" ||
    field === "billingMonths"
  ) {
    return "PRICE_CHANGE";
  }
  if (field === "available" || field === "removedAt" || field === "addedAt") {
    return "AVAILABILITY_CHANGE";
  }
  if (field === "status") return "STATUS_CHANGE";
  return "DATA_CHANGE";
}

/** Atalho para auditoria de criação com um resumo legível. */
export async function writeCreationAudit(
  db: AuditDb,
  context: AuditContext,
  snapshot: Record<string, unknown>
): Promise<unknown> {
  return writeAuditEvent(db, {
    ...context,
    field: null,
    oldValue: null,
    newValue: sanitizeForLog(snapshot),
    metadata: { ...context.metadata, created: true },
  });
}
