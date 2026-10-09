import { createHash } from "node:crypto";
import { scanSecurityDefiner, type Violation } from "./audit-sql-signatures";

/** Reviewed forward replaces existing functions without rewriting their ACL.
 * Exact bytes pin BOTH pre/post owner, ACL, SECURITY DEFINER and search_path
 * assertions plus the source-body preconditions. Drift must use normal H6.
 * This is not an annotation-based or general SECURITY DEFINER exemption.
 */
const REVIEWED_FORWARD = "20261009174000_cxp_centavo_sin_cobertura.sql";
const REVIEWED_SHA256 = "d54365354a0dbbe59353247adead9f93d298f48a7a1b5796fb23045040a873be";

export function scanSecurityDefinerWithPreservedAcl(
  file: string,
  body: string,
  auditPostBaseline: boolean,
): Violation[] {
  const exactReviewedForward = file === REVIEWED_FORWARD
    && createHash("sha256").update(body, "utf8").digest("hex") === REVIEWED_SHA256;
  // The underlying scanner ALWAYS enforces the hard TO PUBLIC prohibition.
  return scanSecurityDefiner(file, body, auditPostBaseline && !exactReviewedForward);
}
