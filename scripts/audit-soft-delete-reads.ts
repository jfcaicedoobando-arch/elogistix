#!/usr/bin/env bun
/**
 * Regresión de lecturas con borrado lógico (soft delete).
 *
 * Objetivo: que un registro eliminado NUNCA reaparezca en listados,
 * contadores o buscadores de ningún módulo. Toda lectura del cliente
 * (`supabase.from("<tabla con deleted_at>").select(...)`) debe filtrar
 * `deleted_at IS NULL`, salvo excepción declarada.
 *
 * Cómo se declara una excepción legítima (p. ej. la Papelera, que
 * justamente lista lo eliminado):
 *   // SOFT-DELETE-OK: motivo corto
 * en la misma cadena de la consulta.
 *
 * Deuda histórica: `scripts/audit-soft-delete-baseline.json`. La baseline
 * sólo puede bajar, nunca subir:
 *   - lectura nueva sin filtro y sin marca  => ❌ falla (fuga)
 *   - entrada de baseline ya corregida      => ❌ falla (hay que limpiarla)
 *
 * Uso:
 *   bun run audit:soft-delete            # verifica
 *   bun run audit:soft-delete -- --update # regenera la baseline
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const SRC = resolve(ROOT, "src");
const BASELINE_PATH = resolve(ROOT, "scripts/audit-soft-delete-baseline.json");

/** Tablas del esquema `public` con columna `deleted_at`. */
const SOFT_DELETE_TABLES: readonly string[] = [
  "anticipos_aplicaciones",
  "anticipos_proveedor",
  "bbva_movimientos",
  "cliente_documentos",
  "clientes",
  "comisiones_devengadas",
  "comisiones_excepciones",
  "conceptos_costo",
  "conceptos_factura",
  "conceptos_venta",
  "contactos_cliente",
  "cotizacion_costos",
  "cotizacion_plantillas",
  "cotizaciones",
  "crm_actividades",
  "crm_comentarios_oportunidad",
  "crm_etapa_criterios",
  "crm_etapas_pipeline",
  "crm_leads",
  "crm_motivos_perdida",
  "crm_oportunidades",
  "crm_plantillas_mensaje",
  "cuentas_bancarias",
  "documentos_embarque",
  "embarque_contenedores",
  "embarque_facturas_entrantes",
  "embarque_garantias_contenedor",
  "embarques",
  "eventos_embarque",
  "factura_notas_credito",
  "facturas",
  "liquidaciones_comision",
  "notas_embarque",
  "pagos_factura",
  "pagos_factura_lote",
  "pagos_proveedor",
  "pagos_proveedor_lote",
  "proforma_conceptos_consolidados",
  "proformas",
  "proveedor_contactos",
  "proveedor_documentos",
  "proveedor_facturas",
  "proveedor_notas_credito",
  "proveedores",
  "seguros_embarque",
  "traspasos_bancarios",
];

const TABLE_SET = new Set(SOFT_DELETE_TABLES);
const FROM_RE = /\.from\(\s*["'`]([a-z0-9_]+)["'`]\s*\)/g;
const MARKER = "SOFT-DELETE-OK";
/** Líneas de contexto que se inspeccionan cuando la consulta se arma por partes. */
const CONTEXT_LINES = 60;

export interface Hallazgo {
  readonly archivo: string;
  readonly tabla: string;
  readonly linea: number;
  /** `listado` = listas, contadores y buscadores. `puntual` = un registro por id. */
  readonly tipo: "listado" | "puntual";
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Ventana de texto que representa la consulta: la sentencia + contexto del bloque. */
export function ventanaConsulta(contenido: string, indice: number): string {
  const resto = contenido.slice(indice);
  const finSentencia = resto.indexOf(";");
  const sentencia = finSentencia < 0 ? resto : resto.slice(0, finSentencia + 1);
  const contexto = resto.split("\n").slice(0, CONTEXT_LINES).join("\n");
  // El contexto cubre los builders armados por partes (`let q = ...; q = q.eq(...)`).
  return `${sentencia}\n${contexto}`;
}

/** Escrituras (insert/update/upsert/delete): no son listados, no aplican. */
export function esEscritura(ventana: string): boolean {
  const escritura = ventana.search(/\.(insert|update|upsert|delete)\(/);
  if (escritura < 0) return false;
  const lectura = ventana.search(/\.select\(/);
  return lectura < 0 || escritura < lectura;
}

/** Lectura puntual de un registro ya conocido (por id) — no es listado ni buscador. */
export function esLecturaPuntual(ventana: string): boolean {
  return /\.(maybeSingle|single)\(/.test(ventana) || /\.eq\(\s*["'`]id["'`]/.test(ventana);
}

/** ¿La lectura excluye los registros eliminados (o está exceptuada a propósito)? */
export function lecturaProtegida(ventana: string): boolean {
  if (ventana.includes(MARKER)) return true;
  return /deleted_at/.test(ventana);
}

function lineaDe(contenido: string, indice: number): number {
  return contenido.slice(0, indice).split("\n").length;
}

/** `supabase.storage.from("facturas")` es un bucket, no una tabla. */
export function esBucketStorage(contenido: string, indice: number): boolean {
  return contenido.slice(Math.max(0, indice - 40), indice).includes("storage");
}

function analizarArchivo(archivo: string): Hallazgo[] {
  const contenido = readFileSync(archivo, "utf8");
  if (!contenido.includes(".from(")) return [];
  const hallazgos: Hallazgo[] = [];
  for (const m of contenido.matchAll(FROM_RE)) {
    const tabla = m[1];
    if (!TABLE_SET.has(tabla)) continue;
    const indice = m.index ?? 0;
    if (esBucketStorage(contenido, indice)) continue;
    const ventana = ventanaConsulta(contenido, indice);
    if (esEscritura(ventana) || lecturaProtegida(ventana)) continue;
    hallazgos.push({
      archivo: relative(ROOT, archivo),
      tabla,
      linea: lineaDe(contenido, indice),
      tipo: esLecturaPuntual(ventana) ? "puntual" : "listado",
    });
  }
  return hallazgos;
}

export function auditarLecturas(): Hallazgo[] {
  return walk(SRC)
    .flatMap(analizarArchivo)
    .sort((a, b) => `${a.archivo}${a.tabla}`.localeCompare(`${b.archivo}${b.tabla}`));
}

export function claveDe(h: Hallazgo): string {
  return `${h.archivo}::${h.tabla}`;
}

export function leerBaseline(): string[] {
  try {
    const raw = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as { deuda?: string[] };
    return raw.deuda ?? [];
  } catch {
    return [];
  }
}

function escribirBaseline(claves: readonly string[]): void {
  const contenido = {
    _doc:
      "Deuda histórica de lecturas sin filtro `deleted_at IS NULL`. Sólo puede bajar. " +
      "Regenerar con `bun run audit:soft-delete -- --update` SÓLO al corregir entradas.",
    deuda: [...new Set(claves)].sort(),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(contenido, null, 2)}\n`, "utf8");
}

function reportar(fugas: Hallazgo[], muertas: string[]): number {
  if (fugas.length > 0) {
    console.error(
      `❌ ${fugas.length} lectura(s) de tablas con borrado lógico sin filtro \`deleted_at\`:`,
    );
    for (const f of fugas) {
      console.error(`  [${f.tipo}] ${f.archivo}:${f.linea} → ${f.tabla}`);
    }
    console.error(
      '\nAgrega `.is("deleted_at", null)` a la consulta, o marca la excepción con ' +
        `\`// ${MARKER}: motivo\` si el listado debe mostrar registros eliminados (Papelera).`,
    );
  }
  if (muertas.length > 0) {
    console.error(`\n❌ ${muertas.length} entrada(s) de baseline ya corregida(s):`);
    for (const k of muertas) console.error(`  ${k}`);
    console.error("\nCorre `bun run audit:soft-delete -- --update` y commitea la baseline.");
  }
  if (fugas.length === 0 && muertas.length === 0) {
    const deuda = leerBaseline().length;
    console.log(
      `✅ audit:soft-delete — sin fugas nuevas (${deuda} lectura(s) en deuda histórica).`,
    );
  }
  return fugas.length + muertas.length === 0 ? 0 : 1;
}

function main(): void {
  const hallazgos = auditarLecturas();
  const claves = hallazgos.map(claveDe);
  if (process.argv.includes("--update")) {
    escribirBaseline(claves);
    console.log(`✅ Baseline actualizada: ${new Set(claves).size} lectura(s) en deuda.`);
    return;
  }
  const baseline = new Set(leerBaseline());
  const fugas = hallazgos.filter((h) => !baseline.has(claveDe(h)));
  const vigentes = new Set(claves);
  const muertas = [...baseline].filter((k) => !vigentes.has(k)).sort();
  process.exit(reportar(fugas, muertas));
}

if (import.meta.main) main();
