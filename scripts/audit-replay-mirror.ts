/**
 * R4BD-01/R4BD-03 / ARQ04: compara cada firma canónica con la última
 * CREATE OR REPLACE FUNCTION que la define, por timestamp y orden de aparición.
 * Las excepciones fijan ambas definiciones SHA-256, la migración efectiva,
 * responsable, justificación y condición de retirada. Cualquier cambio falla.
 *
 * Normaliza comentarios y espacios fuera de literales y el delimitador exterior
 * del cuerpo SQL/PLpgSQL. No cambia SQL, no ejecuta migraciones y no sustituye
 * replay, permisos o invariantes en una BD efímera. Sólo modela declaraciones
 * CREATE OR REPLACE FUNCTION public.<nombre sin comillas>: CREATE simple,
 * nombres entrecomillados, ALTER/DROP y SQL dinámico requieren replay real.
 * Uso: bun run audit:replay-mirror.
 */
import fs from "node:fs";
import path from "node:path";
import { auditarReplayMirror, leerBaseline } from "./lib/replayMirror";

const ROOT = process.cwd();
const SCHEMA_DIR = path.join(ROOT, "supabase", "schema");
const MIG_DIR = path.join(ROOT, "supabase", "migrations");
/** Dumps completos y espejos ACL/RLS no son cuerpos canónicos de función. */
const EXENTOS = new Set(["supabase/schema/baseline.sql"]);
const DIRS_EXENTOS = ["supabase/schema/squash/", "supabase/schema/acl/"];

function listarSql(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listarSql(full, acc);
    else if (entry.name.endsWith(".sql")) acc.push(full);
  }
  return acc;
}

try {
  const baseline = leerBaseline(JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "audit-replay-mirror-baseline.json"), "utf8")));
  const migraciones = new Map(fs.readdirSync(MIG_DIR).filter((file) => file.endsWith(".sql"))
    .map((file) => [file, fs.readFileSync(path.join(MIG_DIR, file), "utf8")]));
  const espejos = new Map(listarSql(SCHEMA_DIR).map((file) => {
    const relative = path.relative(ROOT, file).split(path.sep).join("/");
    return [relative, fs.readFileSync(file, "utf8")] as const;
  }).filter(([file]) => !EXENTOS.has(file) && !DIRS_EXENTOS.some((dir) => file.startsWith(dir))));
  const result = auditarReplayMirror(espejos, migraciones, baseline);
  if (result.violaciones.length) {
    console.error("❌ audit:replay-mirror — divergencia o excepción fuera de su huella exacta:");
    for (const violation of result.violaciones) console.error(`  - ${violation}`);
    console.error("Revisa el replay efectivo; alinea el espejo o crea una migración NUEVA. Nunca edites migraciones aplicadas ni amplíes el baseline para conseguir verde.");
    process.exitCode = 1;
  } else {
    console.log(`⚠️  ${result.tolerados} divergencias preexistentes con huella exacta (deuda R4BD-01/R4BD-03).`);
    console.log(`✅ audit:replay-mirror — ${result.verificados} firmas espejo == migración vigente en ${espejos.size} archivos canónicos.`);
  }
} catch (error) {
  console.error(`❌ audit:replay-mirror — ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
