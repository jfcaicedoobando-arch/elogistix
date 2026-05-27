/**
 * CLI delgado para auditoría arquitectónica. Lógica en `scripts/lib/arch.ts`.
 * Uso: `bun run audit:arch`.
 */
import { runArchAudit, MAX_LINES } from "./lib/arch";

function header(title: string) {
  console.log(`\n${"=".repeat(64)}\n${title}\n${"=".repeat(64)}`);
}

const { hooksContextsDirectImports, componentsPagesDirectImports, oversized } = runArchAudit(process.cwd());

header("Hooks/Contexts con import directo a @/integrations/supabase/client");
if (hooksContextsDirectImports.length === 0) console.log("✅ Ninguno");
else hooksContextsDirectImports.forEach((f) => console.log(`  • ${f}`));

header("Components/Pages con import directo a @/integrations/supabase/client");
if (componentsPagesDirectImports.length === 0) console.log("✅ Ninguno");
else componentsPagesDirectImports.forEach((f) => console.log(`  • ${f}`));

header(`Archivos productivos > ${MAX_LINES} líneas (Power-of-10 #4)`);
if (oversized.length === 0) console.log("✅ Ninguno");
else oversized.forEach(({ file, lines }) => console.log(`  • ${lines.toString().padStart(4)}  ${file}`));

console.log(
  `\nResumen: hooks/contexts=${hooksContextsDirectImports.length}  components/pages=${componentsPagesDirectImports.length}  oversized=${oversized.length}\n`,
);
