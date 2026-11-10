import { readFileSync } from "node:fs";
const { stats, errors } = JSON.parse(readFileSync("reports/dependency-audit/browser.json", "utf8"));
if (stats.expected !== 4 || stats.unexpected !== 0 || stats.skipped !== 0 || stats.flaky !== 0 || !Array.isArray(errors) || errors.length !== 0) {
  throw new Error(`Expected 4 passing dependency GUI cases with no skips/retries/errors: ${JSON.stringify({ stats, errors })}`);
}
