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
 * nombres entrecomillados y ALTER/DROP requieren replay real. El único SQL
 * dinámico modelado se limita a Drizzle0035 y 0057: fuentes/preimágenes fijadas,
 * orden y ocurrencias comprobados; ningún otro DO se interpreta. Los triggers,
 * ACL y coincidencia del literal 0057 con las políticas vivas requieren replay real.
 * Uso: bun run audit:replay-mirror.
 */
import fs from "node:fs";
import path from "node:path";
import { auditarIndiceReplayMirror, indexarMigraciones, leerBaseline } from "./lib/replayMirror";

import { aplicarDrizzle0035 } from "./lib/replayMirrorDrizzle0035";
import { aplicarDrizzle0057 } from "./lib/replayMirrorDrizzle0057";
import { readIsolatedDrizzleReplay } from "./ci/drizzle-history/control.mjs";

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
  const isolated = readIsolatedDrizzleReplay(ROOT);
  const journal = JSON.parse(fs.readFileSync(path.join(ROOT, "drizzle/migrations/meta/_journal.json"), "utf8")).entries;
  const index = aplicarDrizzle0035(indexarMigraciones(migraciones), isolated, journal);
  // Las definiciones forward nuevas se aplican después del historial de Supabase.
  const forward = new Map([...isolated].filter(([file]) => Number(file.slice(0, 4)) >= 50));
  for (const [signature, definition] of indexarMigraciones(forward)) index.set(signature, definition);
  const result = auditarIndiceReplayMirror(espejos, aplicarDrizzle0057(index, isolated), baseline);
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
