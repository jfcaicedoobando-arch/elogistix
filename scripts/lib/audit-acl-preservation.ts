import { createHash } from "node:crypto";
import { scanSecurityDefiner, type Violation } from "./audit-sql-signatures";

/** Reviewed forward replaces existing functions without rewriting their ACL.
 * Exact bytes pin BOTH pre/post owner, ACL, SECURITY DEFINER and search_path
 * assertions plus the source-body preconditions. Drift must use normal H6.
 * This is not an annotation-based or general SECURITY DEFINER exemption.
 */
const REVIEWED_FORWARD = "20261009174000_cxp_centavo_sin_cobertura.sql";
const REVIEWED_SHA256 = "475dd768e0388bf6b3d07f09c435b2b17b246ffd8b73d69eaa25ae89becdbadf";

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
