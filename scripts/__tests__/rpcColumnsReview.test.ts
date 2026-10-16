import { describe, expect, it } from "vitest";
import { definitionDigest, matchesReview, parseReviewInventory, type Finding, type ReviewedReference, type SqlObject } from "../lib/rpcColumnsReview";

const obj: SqlObject = { kind: "function", name: "reviewed_rpc", signature: "public.reviewed_rpc(uuid)", body: "SELECT c.value FROM cotizaciones c" };
const dependency: SqlObject = { kind: "function", name: "computed_field", signature: "public.computed_field(cotizaciones)", body: "SELECT 1" };
const finding: Finding = { kind: "function", name: obj.name, alias: "c", tables: ["conceptos_costo"], column: "value", signature: obj.signature, definition_sha256: definitionDigest(obj.body) };
const review: ReviewedReference = {
  key: "function:reviewed_rpc:c.value", signature: obj.signature!, definition_sha256: definitionDigest(obj.body),
  reason: "The alias belongs to cotizaciones in this exact statement.", source: "supabase/migrations/reviewed.sql",
  required_columns: [{ table: "cotizaciones", column: "value" }],
  dependencies: [{ signature: dependency.signature!, definition_sha256: definitionDigest(dependency.body) }],
};
const columns = new Map([["cotizaciones", new Set(["value"])]]);
const objects = [obj, dependency];

describe("RPC reference reviews fail closed", () => {
  it("accepts the exact reference, definition, dependency and real column", () => {
    expect(matchesReview(review, finding, objects, columns)).toBe(true);
    expect(parseReviewInventory({ allow: [], reviewed: [review] }).reviewed).toEqual([review]);
  });
  it("rejects a changed definition, even when an old reviewed overload still exists", () => {
    const changed = { ...obj, body: "SELECT c.missing FROM cotizaciones c" };
    expect(matchesReview(review, { ...finding, definition_sha256: definitionDigest(changed.body) }, [obj, changed, dependency], columns)).toBe(false);
    expect(matchesReview(review, finding, [changed, dependency], columns)).toBe(false);
    expect(matchesReview(review, { ...finding, signature: "public.reviewed_rpc(text)" }, objects, columns)).toBe(false);
  });
  it("rejects another column or object instead of extending the exemption", () => {
    expect(matchesReview(review, { ...finding, column: "missing" }, objects, columns)).toBe(false);
    expect(matchesReview(review, { ...finding, name: "other_rpc" }, objects, columns)).toBe(false);
    expect(matchesReview(review, { ...finding, kind: "view" }, objects, columns)).toBe(false);
  });
  it("rejects missing columns and missing or changed computed-field dependencies", () => {
    expect(matchesReview(review, finding, objects, new Map())).toBe(false);
    expect(matchesReview(review, finding, [obj], columns)).toBe(false);
    expect(matchesReview(review, finding, [obj, { ...dependency, body: "SELECT 2" }], columns)).toBe(false);
  });
  it.each([
    { ...review, reason: "" }, { ...review, source: "" },
    { ...review, definition_sha256: "bad" }, { ...review, signature: "public.other_rpc(uuid)" },
    { ...review, required_columns: [] }, { ...review, dependencies: [{ signature: "bad", definition_sha256: "bad" }] },
  ])("rejects incomplete or unscoped review metadata %j", (item) => {
    expect(() => parseReviewInventory({ allow: [], reviewed: [item] })).toThrow();
  });
  it("rejects duplicated reviews and overlap with legacy entries", () => {
    expect(() => parseReviewInventory({ allow: [], reviewed: [review, review] })).toThrow(/Duplicate/);
    expect(() => parseReviewInventory({ allow: [review.key], reviewed: [review] })).toThrow(/Duplicate/);
    expect(() => parseReviewInventory({ allow: ["a", "a"], reviewed: [] })).toThrow(/Duplicate/);
  });
});
