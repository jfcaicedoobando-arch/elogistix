import { createHash } from "node:crypto";

export interface SqlObject {
  kind: "function" | "view";
  name: string;
  body: string;
  signature?: string;
}
export interface Finding {
  kind: string; name: string; alias: string; tables: string[]; column: string;
  signature?: string; definition_sha256: string;
}
type DefinitionPin = { signature: string; definition_sha256: string };
export type ReviewedReference = DefinitionPin & {
  key: string;
  reason: string;
  source: string;
  required_columns: { table: string; column: string }[];
  dependencies: DefinitionPin[];
};
export type ReviewInventory = { allow: string[]; reviewed: ReviewedReference[] };
const digestPattern = /^[a-f0-9]{64}$/;
const keyPattern = /^function:([a-z_][a-z0-9_]*):[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const pin = (value: unknown): value is DefinitionPin => record(value)
  && typeof value.signature === "string" && /^public\.[a-z_][a-z0-9_]*\([^;]*\)$/.test(value.signature)
  && typeof value.definition_sha256 === "string" && digestPattern.test(value.definition_sha256);

function reviewMetadata(value: DefinitionPin & Record<string, unknown>): boolean {
  return typeof value.key === "string" && keyPattern.test(value.key)
    && value.signature.startsWith(`public.${value.key.split(":")[1]}(`)
    && typeof value.reason === "string" && Boolean(value.reason.trim())
    && typeof value.source === "string" && value.source.startsWith("supabase/");
}
function requiredColumns(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
    && value.every((column) => record(column) && typeof column.table === "string" && typeof column.column === "string");
}
function reviewedReference(value: unknown): value is ReviewedReference {
  return pin(value) && record(value) && reviewMetadata(value) && requiredColumns(value.required_columns)
    && Array.isArray(value.dependencies) && value.dependencies.every(pin);
}

/** Invalid, duplicate or unscoped reviews must fail rather than suppress findings. */
export function parseReviewInventory(value: unknown): ReviewInventory {
  if (!record(value) || !Array.isArray(value.allow) || !value.allow.every((key) => typeof key === "string")) {
    throw new Error("Invalid RPC-column legacy inventory");
  }
  const reviewed = value.reviewed ?? [];
  if (!Array.isArray(reviewed)) throw new Error("Invalid RPC-column reviewed inventory");
  const keys = new Set(value.allow);
  if (keys.size !== value.allow.length) throw new Error("Duplicate RPC-column inventory key");
  for (const item of reviewed) {
    if (!reviewedReference(item)) {
      throw new Error("Invalid or unscoped RPC-column review");
    }
    if (keys.has(item.key)) throw new Error(`Duplicate RPC-column inventory key: ${item.key}`);
    keys.add(item.key);
  }
  return { allow: value.allow as string[], reviewed: reviewed as ReviewedReference[] };
}

export const findingKey = (finding: Finding) => `${finding.kind}:${finding.name}:${finding.alias}.${finding.column}`;
export const definitionDigest = (body: string) => createHash("sha256").update(body, "utf8").digest("hex");

/** A review applies to one reference in one exact definition, including dependencies. */
export function matchesReview(
  review: ReviewedReference, finding: Finding, objects: SqlObject[], columns: Map<string, Set<string>>,
): boolean {
  if (findingKey(finding) !== review.key || finding.signature !== review.signature
    || finding.definition_sha256 !== review.definition_sha256) return false;
  const definitions = [review, ...review.dependencies];
  if (!definitions.every((expected) => objects.some((obj) => obj.kind === "function"
    && obj.signature === expected.signature && definitionDigest(obj.body) === expected.definition_sha256))) return false;
  return review.required_columns.every(({ table, column }) => columns.get(table)?.has(column));
}
