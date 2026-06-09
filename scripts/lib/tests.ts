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
  rule: "skip-without-issue" | "duplicate-title" | "missing-assertions";
  detail: string;
}

const SKIP_REGEX = /\b(it|test|describe)\.(skip|only|todo)\(|\bxdescribe\(|\bxit\(/;
const ISSUE_REGEX = /\/\/\s*(TODO|FIXME)\(#\d+\)/i;
const TITLE_REGEX = /^\s*(describe|it|test)\(/;
// Detecta el inicio de un caso de test (no `describe`, no `.skip/.only/.todo`).
const TEST_START_REGEX = /^\s*(it|test)\(\s*(['"`])([^'"`]+)\2/;
// Heurística de aserción: expect(...), assert*, expectTypeOf, toThrow vía cualquier matcher.
const ASSERTION_REGEX = /\b(expect|expectTypeOf|assert|assertEquals|assertExists|assertRejects|assertThrows)\s*[(.]/;

/**
 * Quita el contenido de strings (', ", `) y comentarios `//` de una línea,
 * para que el conteo de llaves no se confunda con `{}` dentro de títulos
 * o mensajes (ej. `it("retorna {} ...", ...)`).
 */
function stripStringsAndComments(line: string): string {
  let out = "";
  let i = 0;
  while (i < line.length) {
    const ch = line[i]!;
    if (ch === "/" && line[i + 1] === "/") break; // resto es comentario
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < line.length) {
        if (line[i] === "\\") {
          i += 2;
          continue;
        }
        if (line[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Devuelve la posición (índice 0-based en `lines`) del `}` que cierra el bloque
 * iniciado tras el primer `{` que aparece en/después de `startLine`. Si no se
 * encuentra balance, retorna `lines.length - 1`.
 */
function findBlockEnd(lines: string[], startLine: number): number {
  let depth = 0;
  let started = false;
  for (let i = startLine; i < lines.length; i++) {
    const cleaned = stripStringsAndComments(lines[i] ?? "");
    for (const ch of cleaned) {
      if (ch === "{") {
        depth++;
        started = true;
      } else if (ch === "}") {
        depth--;
        if (started && depth === 0) return i;
      }
    }
  }
  return lines.length - 1;
}

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

      // Regla missing-assertions: cada `it`/`test` (no skip/only/todo) debe
      // contener al menos una aserción dentro de su bloque. Evita "ghost tests"
      // que pasan sin verificar nada (regresión silenciosa).
      const m = TEST_START_REGEX.exec(raw);
      if (m && !SKIP_REGEX.test(raw)) {
        const end = findBlockEnd(lines, idx);
        let hasAssertion = false;
        for (let j = idx; j <= end; j++) {
          if (ASSERTION_REGEX.test(lines[j] ?? "")) {
            hasAssertion = true;
            break;
          }
        }
        if (!hasAssertion) {
          violations.push({
            file: rel,
            line: idx + 1,
            rule: "missing-assertions",
            detail: `it/test sin expect/assert: ${m[3]}`,
          });
        }
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
