/**
 * Auditoría de higiene de tests. Puro (sin side-effects).
 * Consumido por `scripts/audit-tests.ts` y `scripts/audit-report.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walk, relPath } from "./walk";

export const DUPLICATE_ALLOWLIST = new Set<string>([
  `it("vacío/null → ''", () => {`,
  `it("convierte MXN a USD", () => {`,
  `it("convierte números a string", () => {`,
  `it("returns empty map for empty input", () => {`,
]);

export interface TestViolation {
  file: string;
  line: number;
  rule: "skip-without-issue" | "duplicate-title";
  detail: string;
}

const SKIP_REGEX = /\b(it|test|describe)\.(skip|only|todo)\(|\bxdescribe\(|\bxit\(/;
const ISSUE_REGEX = /\/\/\s*(TODO|FIXME)\(#\d+\)/i;
const TITLE_REGEX = /^\s*(describe|it|test)\(/;

export function auditTests(root: string): TestViolation[] {
  const violations: TestViolation[] = [];
  const titleIndex = new Map<string, string[]>();

  for (const file of walk(join(root, "src"), { excludeDirs: ["node_modules"] })) {
    if (!/\.(test|spec)\.tsx?$/.test(file)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    const rel = relPath(root, file);

    lines.forEach((raw, idx) => {
      if (SKIP_REGEX.test(raw)) {
        const prev = idx > 0 ? lines[idx - 1] : "";
        if (!ISSUE_REGEX.test(prev) && !ISSUE_REGEX.test(raw)) {
          violations.push({ file: rel, line: idx + 1, rule: "skip-without-issue", detail: raw.trim() });
        }
      }
      if (TITLE_REGEX.test(raw)) {
        const key = raw.trim();
        if (!titleIndex.has(key)) titleIndex.set(key, []);
        titleIndex.get(key)!.push(`${rel}:${idx + 1}`);
      }
    });
  }

  for (const [title, locations] of titleIndex) {
    if (locations.length < 2) continue;
    if (DUPLICATE_ALLOWLIST.has(title)) continue;
    const files = new Set(locations.map((l) => l.split(":")[0]));
    if (files.size < 2) continue;
    violations.push({
      file: locations[0]!.split(":")[0]!,
      line: Number(locations[0]!.split(":")[1]),
      rule: "duplicate-title",
      detail: `${title}  ←→  ${locations.slice(1).join(", ")}`,
    });
  }

  return violations;
}
