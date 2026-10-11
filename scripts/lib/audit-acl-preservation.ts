import { createHash } from "node:crypto";
import { scanSecurityDefiner, type Violation } from "./audit-sql-signatures";

/** Reviewed forward replaces existing functions without rewriting their ACL.
 * Exact bytes pin BOTH pre/post owner, ACL, SECURITY DEFINER and search_path
 * assertions plus the source-body preconditions. Drift must use normal H6.
 * This is not an annotation-based or general SECURITY DEFINER exemption.
 */
const REVIEWED_FORWARDS: ReadonlyMap<string, string> = new Map([
  ["20261009174000_cxp_centavo_sin_cobertura.sql", "d54365354a0dbbe59353247adead9f93d298f48a7a1b5796fb23045040a873be"],
  ["20261011180000_proforma_cancelada_acciones_terminales.sql", "6bb7e0e039aa9057d541f53cc8f8b4d857948a225414fce1e65456b580e358f2"],
]);

export function scanSecurityDefinerWithPreservedAcl(
  file: string,
  body: string,
  auditPostBaseline: boolean,
): Violation[] {
  const exactReviewedForward = REVIEWED_FORWARDS.get(file)
    === createHash("sha256").update(body, "utf8").digest("hex");
  // The underlying scanner ALWAYS enforces the hard TO PUBLIC prohibition.
  return scanSecurityDefiner(file, body, auditPostBaseline && !exactReviewedForward);
}
