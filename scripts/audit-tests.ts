/**
 * CLI: higiene de tests. Falla con exit 1 si hay violaciones.
 * Lógica en `scripts/lib/tests.ts`.
 *
 * Uso: `bun run audit:tests`.
 */
import { auditTests, type TestViolation } from "./lib/tests";

function main() {
  const violations = auditTests(process.cwd());
  if (violations.length === 0) {
    console.log("✓ Test hygiene: 0 violations");
    return;
  }

  console.error(`\n✗ Test hygiene: ${violations.length} violation(s)\n`);
  const byRule = violations.reduce<Record<string, TestViolation[]>>((acc, v) => {
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
      "    o agrégalo a DUPLICATE_ALLOWLIST en scripts/lib/tests.ts si es intencional.\n" +
      "  • missing-assertions: añade al menos un `expect(...)` o `assert*` dentro del bloque del test.\n" +
      "    Si es un smoke de 'no-throw', usa `expect(() => fn()).not.toThrow()`.\n",
  );
  process.exit(1);
}

main();
