/**
 * R4BD-01/R4BD-03 · Guardrail: para cada función con espejo en
 * `supabase/schema/**`, la migración de MAYOR timestamp que la define
 * (`CREATE OR REPLACE FUNCTION public.<f>(…)`) debe producir el MISMO cuerpo
 * que el espejo. Casos que lo motivan: las migraciones de la Ola 12 quedaron
 * estampadas 20260813xxxxx, anteriores a `20260821030800_ola11_lotes_paridad.sql`
 * y `20260819090000_ola6_rg51_regenerar_movimiento_fail_closed.sql`, que
 * redefinen `registrar_pago_proveedor_lote` y
 * `regenerar_movimiento_pago_proveedor` sin los guards LC_LOTE_TC_REQUERIDO /
 * LC_LOTE_FACTURA_MONEDA / LC_PAGO_TC_REQUERIDO. En replay limpio la última
 * definición por timestamp gana y pisa los fixes; `audit:schema-functions`
 * sólo valida formato del espejo y no lo detectaba.
 *
 * Alcance deliberado: compara ÚNICAMENTE el statement CREATE OR REPLACE
 * FUNCTION (firma + cuerpo), normalizado (sin comentarios `--`, espacios
 * colapsados). Los REVOKE/GRANT del espejo no entran en la comparación.
 * Estático: no requiere BD; corre en cualquier job de CI.
 *
 * Baseline: `scripts/audit-replay-mirror-baseline.json` lista las divergencias
 * PREEXISTENTES al guardrail (deuda técnica de la misma clase, fuera del
 * alcance del Sprint 06). Se reportan como advertencia; si una deja de
 * divergir hay que borrarla del baseline (entrada muerta ⇒ exit 1).
 *
 * Uso: `bun run audit:replay-mirror`. Exit 1 si algún espejo diverge de la
 * migración vigente (mayor timestamp) o si no existe migración que lo defina.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCHEMA_DIR = path.join(ROOT, "supabase", "schema");
const MIG_DIR = path.join(ROOT, "supabase", "migrations");
/** `baseline.sql` es un dump completo del esquema, no una función canónica. */
const EXENTOS = new Set<string>(["supabase/schema/baseline.sql"]);
/** `schema/squash/*.sql` son dumps consolidados del esquema, no espejos. */
/** `schema/acl/*.sql` son espejos de ACL/RLS (REVOKE/GRANT/POLICY), no cuerpos de función. */
const DIRS_EXENTOS = ["supabase/schema/squash/", "supabase/schema/acl/"];
const BASELINE_FILE = path.join(ROOT, "scripts", "audit-replay-mirror-baseline.json");

interface EntradaBaseline {
  espejo: string;
  funcion: string;
  migracion_vigente: string;
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf-8")) as {
  entradas: EntradaBaseline[];
};
const enBaseline = new Set(baseline.entradas.map((e) => `${e.espejo}::${e.funcion}`));
const baselineUsado = new Set<string>();

interface DefinicionFuncion {
  nombre: string;
  /** Statement CREATE OR REPLACE FUNCTION completo, normalizado. */
  cuerpo: string;
}

function listarSql(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) listarSql(full, acc);
    else if (entry.endsWith(".sql")) acc.push(full);
  }
  return acc;
}

/** Quita comentarios de línea y colapsa espacios: compara cuerpo, no formato. */
function normalizar(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrae los statements `CREATE OR REPLACE FUNCTION public.<f>(…) AS <tag>
 * … <tag>;` en orden de aparición. El cuerpo termina en el dollar-quote de
 * cierre (`$$`, `$function$`, `$fn$`…) seguido de `;`. Limitación conocida:
 * si el cuerpo anidara otro dollar-quote con el MISMO tag, el corte sería
 * prematuro; ninguna función canónica del repo lo hace.
 */
function extraerFunciones(src: string): DefinicionFuncion[] {
  const re = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-zA-Z0-9_]+)\s*\(/gi;
  const out: DefinicionFuncion[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const resto = src.slice(m.index);
    const tag = resto.match(/\$[a-zA-Z0-9_]*\$/);
    if (!tag || tag.index === undefined) {
      // Sin dollar-quote: función SQL plana; corta en el primer `;`
      const finPlano = resto.indexOf(";");
      if (finPlano === -1) continue;
      out.push({ nombre: m[1], cuerpo: normalizar(resto.slice(0, finPlano + 1)) });
      re.lastIndex = m.index + finPlano + 1;
      continue;
    }
    const cierre = resto.indexOf(tag[0], tag.index + tag[0].length);
    if (cierre === -1) continue;
    const despues = resto.slice(cierre + tag[0].length);
    const finMatch = /^\s*;/.exec(despues);
    const fin = cierre + tag[0].length + (finMatch ? finMatch[0].length : 0);
    out.push({ nombre: m[1], cuerpo: normalizar(resto.slice(0, fin)) });
    re.lastIndex = m.index + fin;
  }
  return out;
}

// ── Índice: función → migración de MAYOR timestamp que la define ────────────
// Las migraciones se recorren en orden ascendente de nombre (== timestamp),
// así que el último registro que escribe cada llave es el vigente en replay.
const migraciones = fs
  .readdirSync(MIG_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const cacheMig = new Map<string, DefinicionFuncion[]>();
const ultimaMigracion = new Map<string, string>(); // nombre -> archivo
for (const mig of migraciones) {
  const src = fs.readFileSync(path.join(MIG_DIR, mig), "utf-8");
  const defs = extraerFunciones(src);
  cacheMig.set(mig, defs);
  for (const d of defs) ultimaMigracion.set(d.nombre, mig);
}

// ── Comparación espejo vs migración vigente ─────────────────────────────────
const espejos = listarSql(SCHEMA_DIR).filter(
  (f) => {
    const rel = path.relative(ROOT, f).split(path.sep).join("/");
    return !EXENTOS.has(rel) && !DIRS_EXENTOS.some((d) => rel.startsWith(d));
  },
);

const violaciones: string[] = [];
let verificados = 0;

for (const file of espejos) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const src = fs.readFileSync(file, "utf-8");
  const defsEspejo = extraerFunciones(src);
  if (defsEspejo.length === 0) {
    violaciones.push(
      `  - ${rel}: no se pudo extraer ningún CREATE OR REPLACE FUNCTION (formato inválido; lo valida audit:schema-functions)`,
    );
    continue;
  }

  // Un espejo puede alojar varias funciones u overloads: se compara por nombre.
  const nombres = [...new Set(defsEspejo.map((d) => d.nombre))];
  for (const nombre of nombres) {
    const mig = ultimaMigracion.get(nombre);
    if (!mig) {
      violaciones.push(`  - ${rel}: \`${nombre}\` no tiene migración que la defina (espejo huérfano)`);
      continue;
    }
    const esperado = defsEspejo.filter((d) => d.nombre === nombre).map((d) => d.cuerpo);
    const vigente = (cacheMig.get(mig) ?? []).filter((d) => d.nombre === nombre).map((d) => d.cuerpo);
    const llave = `${rel}::${nombre}`;
    if (JSON.stringify(esperado) === JSON.stringify(vigente)) {
      if (enBaseline.has(llave)) {
        violaciones.push(
          `  - ${llave}: ya NO diverge — bórrala de scripts/audit-replay-mirror-baseline.json (entrada muerta)`,
        );
        baselineUsado.add(llave);
        continue;
      }
      verificados++;
      continue;
    }
    if (enBaseline.has(llave)) {
      baselineUsado.add(llave);
      continue;
    }
    // Reporte: primer punto de divergencia sobre los cuerpos normalizados.
    const a = esperado.join("\n");
    const b = vigente.join("\n");
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    const desde = Math.max(0, i - 60);
    violaciones.push(
      `  - ${rel}: \`${nombre}\` diverge de la migración vigente ${mig}\n` +
        `      espejo:    …${a.slice(desde, i + 80)}…\n` +
        `      migración: …${b.slice(desde, i + 80)}…`,
    );
  }
}

for (const llave of enBaseline) {
  if (!baselineUsado.has(llave)) {
    violaciones.push(
      `  - ${llave}: entrada del baseline que ya no existe en el repo — bórrala de scripts/audit-replay-mirror-baseline.json`,
    );
  }
}

if (violaciones.length > 0) {
  console.error(
    "❌ Espejos que divergen de la migración de MAYOR timestamp que los define (replay roto — clase R4BD-01/R4BD-03):",
  );
  for (const v of violaciones) console.error(v);
  console.error(
    "Fix: re-emite el cuerpo del espejo como migración NUEVA con timestamp posterior (nunca edites migraciones ya aplicadas).",
  );
  process.exit(1);
}
console.log(
  `⚠️  ${enBaseline.size} divergencias preexistentes toleradas por baseline (deuda R4BD-01/R4BD-03).`,
);
console.log(
  `✅ audit:replay-mirror — ${verificados} funciones espejo == migración vigente (mayor timestamp) en ${espejos.length} archivos canónicos.`,
);
