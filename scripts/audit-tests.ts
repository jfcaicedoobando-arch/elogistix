/**
 * Audita la suite de tests y falla con exit 1 si encuentra:
 *   1. `.skip(`, `.only(`, `.todo(`, `xdescribe(` o `xit(` sin la línea anterior
 *      conteniendo un marcador `// TODO(#issue):` o `// FIXME(#issue):`.
 *   2. Bloques `describe(...)` o `it(...)/test(...)` con título idéntico en
 *      otro archivo de test (lista blanca abajo para casos legítimos).
 *
 * No valida imports rotos: ya se cubre con `tsc --noEmit` durante el build.
 *
 * Uso:  bun scripts/audit-tests.ts
 * CI:   step "Test hygiene" en .github/workflows/ci.yml
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** Títulos duplicados aceptados intencionalmente (mismo título, contextos distintos). */
const DUPLICATE_ALLOWLIST = new Set<string>([
  // text.test.ts y phone.test.ts usan el mismo título dentro de describes distintos.
  `it("vacío/null → ''", () => {`,
  // Funciones distintas (aUSD vs convertirAUSD) con el mismo título.
  `it("convierte MXN a USD", () => {`,
  // Helpers con misma firma null-safe en módulos distintos.
  `it("convierte números a string", () => {`,
  // Distintas implementaciones de empty-map.
  `it("returns empty map for empty input", () => {`,
]);

/** Recursión sobre src/, sólo archivos *.test.ts(x). */
function walkTests(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walkTests(p, acc);
    else if (/\.(test|spec)\.tsx?$/.test(name)) acc.push(p);
  }
  return acc;
}

interface Violation {
  file: string;
  line: number;
  rule: "skip-without-issue" | "duplicate-title";
  detail: string;
}

const SKIP_REGEX = /\b(it|test|describe)\.(skip|only|todo)\(|\bxdescribe\(|\bxit\(/;
const ISSUE_REGEX = /\/\/\s*(TODO|FIXME)\(#\d+\)/i;
const TITLE_REGEX = /^\s*(describe|it|test)\(/;

function audit(): Violation[] {
  const violations: Violation[] = [];
  const titleIndex = new Map<string, string[]>(); // título → archivos

  for (const file of walkTests(SRC)) {
    const lines = readFileSync(file, "utf8").split("\n");
    const rel = relative(ROOT, file);

    lines.forEach((raw, idx) => {
      // Regla 1: skip/only/todo sin TODO(#issue)
      if (SKIP_REGEX.test(raw)) {
        const prev = idx > 0 ? lines[idx - 1] : "";
        if (!ISSUE_REGEX.test(prev) && !ISSUE_REGEX.test(raw)) {
          violations.push({
            file: rel,
            line: idx + 1,
            rule: "skip-without-issue",
            detail: raw.trim(),
          });
        }
      }

      // Regla 2: indexar títulos para detectar duplicados
      if (TITLE_REGEX.test(raw)) {
        const key = raw.trim();
        if (!titleIndex.has(key)) titleIndex.set(key, []);
        titleIndex.get(key)!.push(`${rel}:${idx + 1}`);
      }
    });
  }

  // Detectar duplicados cross-file
  for (const [title, locations] of titleIndex) {
    if (locations.length < 2) continue;
    if (DUPLICATE_ALLOWLIST.has(title)) continue;
    // Sólo reportar si los duplicados están en archivos distintos
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

function main() {
  const violations = audit();
  if (violations.length === 0) {
    console.log("✓ Test hygiene: 0 violations");
    return;
  }

  console.error(`\n✗ Test hygiene: ${violations.length} violation(s)\n`);
  const byRule = violations.reduce<Record<string, Violation[]>>((acc, v) => {
    (acc[v.rule] ||= []).push(v);
    return acc;
  }, {});

  for (const [rule, items] of Object.entries(byRule)) {
    console.error(`▸ ${rule} (${items.length})`);
    for (const v of items) {
      console.error(`    ${v.file}:${v.line}`);
      console.error(`      ${v.detail}`);
    }
    console.error("");
  }

  console.error(
    "Cómo arreglar:\n" +
      "  • skip-without-issue: añade un comentario `// TODO(#123): razón` arriba del .skip/.only/.todo,\n" +
      "    o elimina el test si ya no aplica.\n" +
      "  • duplicate-title: renombra el título para reflejar el contexto,\n" +
      "    o agrégalo a DUPLICATE_ALLOWLIST en scripts/audit-tests.ts si es intencional.\n",
  );
  process.exit(1);
}

main();
