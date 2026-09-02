/**
 * RBD-05 · Guardrail: `supabase/releases/migration-manifest.json` debe
 * reflejar exactamente `supabase/migrations/` (invariante del baseline:
 * "manifest == disco").
 *
 * Uso:
 *   bun run audit:manifest               → verifica (exit 1 si diverge)
 *   bun run db:release-manifest:update   → agrega/actualiza la entrada de
 *                                          APP_VERSION con la lista completa
 *                                          y ordenada de migraciones en disco
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIG_DIR = path.join(ROOT, "supabase", "migrations");
const MANIFEST = path.join(ROOT, "supabase", "releases", "migration-manifest.json");
const APP_VERSION_FILE = path.join(ROOT, "src", "constants", "appVersion.ts");

type Manifest = Record<string, { migrations: string[] }>;

const enDisco = fs
  .readdirSync(MIG_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf-8"));

function leerAppVersion(): string {
  const src = fs.readFileSync(APP_VERSION_FILE, "utf-8");
  const m = src.match(/APP_VERSION\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("No se pudo leer APP_VERSION de src/constants/appVersion.ts");
  return m[1];
}

// Cuántas versiones se conservan en el manifest. Cada entrada lista ~1.2k
// migraciones, así que el archivo crece ~70 KB por release; sin poda superaba
// el límite de 10 MB por archivo del repositorio.
const MAX_VERSIONES = 3;

if (process.argv.includes("--update")) {
  const version = leerAppVersion();
  manifest[version] = { migrations: enDisco };
  const ordenado: Manifest = Object.fromEntries(
    Object.entries(manifest)
      .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
      .slice(-MAX_VERSIONES),
  );
  // El manifest actual va con indentación de 2 espacios y SIN newline final;
  // se conserva el formato para que el diff del update sea sólo la nueva llave.
  fs.writeFileSync(MANIFEST, JSON.stringify(ordenado, null, 2));
  console.log(`✅ Manifest actualizado: ${version} → ${enDisco.length} migraciones.`);
  process.exit(0);
}


// Se compara SÓLO contra la entrada de la versión actual: las entradas
// históricas son bitácora inmutable y pueden citar archivos que después se
// renombraron o retiraron (p.ej. la infraestructura de correo legacy).
const versionActual = leerAppVersion();
const entradaActual = manifest[versionActual];
if (!entradaActual) {
  console.error(`❌ migration-manifest.json no tiene entrada para APP_VERSION ${versionActual}.`);
  console.error("Corre `bun run db:release-manifest:update` y commitea el manifest.");
  process.exit(1);
}
const enManifest = new Set(entradaActual.migrations);
const faltan = enDisco.filter((f) => !enManifest.has(f));
const sobran = [...enManifest].filter((f) => !enDisco.includes(f));
if (faltan.length > 0 || sobran.length > 0) {
  console.error("❌ migration-manifest.json diverge de supabase/migrations/:");
  for (const f of faltan) console.error(`  falta en manifest: ${f}`);
  for (const f of sobran) console.error(`  no existe en disco: ${f}`);
  console.error("Corre `bun run db:release-manifest:update` y commitea el manifest.");
  process.exit(1);
}
console.log(`✅ audit:manifest — ${enDisco.length} migraciones en disco == manifest.`);
