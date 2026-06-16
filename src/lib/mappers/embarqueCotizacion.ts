/**
 * Mappers para vincular/desvincular una cotización a un formulario de embarque.
 *
 * v13.33.0 — Pack B extendido: hereda 7 campos adicionales de la cotización
 *  (tarifa, carta garantía, días libres demoras/almacenaje, seguro, valor
 *  seguro y notas). Las nuevas columnas existen en `embarques` desde la
 *  migración 2026-06-16.
 *
 * v13.30.0 — Pack B: contenedores placeholder + respect-overrides en desvincular.
 * v13.28.0 — Precarga ampliada (rutas, MSDS, modo dirigido).
 */

import type { EmbarqueFormValues } from "./embarqueFromDb";
import {
  crearContenedorVacio,
  type ContenedorBorrador,
} from "@/features/embarques/types/contenedor";

export interface CotizacionParaVincular {
  cliente_id: string | null;
  modo: string;
  tipo: string;
  incoterm: string;
  descripcion_mercancia: string;
  tipo_carga: string;
  tipo_contenedor: string | null;
  peso_kg: number;
  volumen_m3: number;
  piezas: number;
  origen: string;
  destino: string;
  msds_archivo?: string | null;
  num_contenedores?: number | null;
  tipo_embarque?: string | null;
  // Pack B+ (v13.33.0)
  tarifa_id?: string | null;
  carta_garantia?: boolean | null;
  dias_libres_destino?: number | null;
  dias_almacenaje?: number | null;
  seguro?: boolean | null;
  valor_seguro_usd?: number | null;
  notas?: string | null;
}

export type DesvincularModo = "limpiar" | "conservar" | "solo-conceptos";

/**
 * Snapshot opcional del valor que el mapper sembró en cada campo al vincular.
 * Si el valor actual del formulario coincide con el snapshot, el campo se
 * considera "no tocado" y puede limpiarse; si difiere, el usuario lo editó
 * y se preserva.
 */
export type VincularSnapshot = Partial<Record<keyof EmbarqueFormValues, unknown>>;

type FieldUpdate = [keyof EmbarqueFormValues, unknown];

const norm = (s: string) => s.trim().toLowerCase();
const esModoMaritimo = (m: string) => ["maritimo", "marítimo"].includes(norm(m));
const esModoAereo = (m: string) => ["aereo", "aéreo"].includes(norm(m));
const esFCL = (cot: CotizacionParaVincular) =>
  norm(cot.tipo_embarque ?? cot.tipo_carga ?? "") === "fcl";

/** Construye N placeholders de contenedores FCL desde la cotización. */
function buildContenedoresPlaceholder(cot: CotizacionParaVincular): ContenedorBorrador[] {
  if (!esFCL(cot) || !esModoMaritimo(cot.modo)) return [];
  const n = Math.max(0, Math.floor(Number(cot.num_contenedores ?? 0)));
  if (n === 0) return [];
  const tipo = cot.tipo_contenedor ?? "";
  return Array.from({ length: n }, (_, i) => ({
    ...crearContenedorVacio(i + 1),
    tipo_contenedor: tipo,
  }));
}

// ── Sub-builders ─────────────────────────────────────────────────────────────

export function buildMercanciaUpdates(cot: CotizacionParaVincular): FieldUpdate[] {
  return [
    ["clienteId", cot.cliente_id || ""],
    ["modo", cot.modo],
    ["tipo", cot.tipo],
    ["incoterm", cot.incoterm],
    ["descripcionMercancia", cot.descripcion_mercancia],
    ["tipoCarga", cot.tipo_carga || "Carga General"],
    ["tipoContenedor", cot.tipo_contenedor || ""],
    ["pesoKg", String(cot.peso_kg || "")],
    ["volumenM3", String(cot.volumen_m3 || "")],
    ["piezas", String(cot.piezas || "")],
  ];
}

export function buildRutaUpdates(cot: CotizacionParaVincular): FieldUpdate[] {
  if (esModoMaritimo(cot.modo)) {
    return [["puertoOrigen", cot.origen || ""], ["puertoDestino", cot.destino || ""]];
  }
  if (esModoAereo(cot.modo)) {
    return [["aeropuertoOrigen", cot.origen || ""], ["aeropuertoDestino", cot.destino || ""]];
  }
  return [["ciudadOrigen", cot.origen || ""], ["ciudadDestino", cot.destino || ""]];
}

export function buildOpcionalUpdates(cot: CotizacionParaVincular): FieldUpdate[] {
  const updates: FieldUpdate[] = [];
  if (cot.msds_archivo) updates.push(["msdsArchivo", cot.msds_archivo]);
  const contenedores = buildContenedoresPlaceholder(cot);
  if (contenedores.length > 0) updates.push(["contenedores", contenedores]);
  return updates;
}

export function buildPackBUpdates(cot: CotizacionParaVincular): FieldUpdate[] {
  return [
    ["tarifaId", cot.tarifa_id ?? ""],
    ["cartaGarantia", Boolean(cot.carta_garantia)],
    ["diasLibresDestino", String(cot.dias_libres_destino ?? 0)],
    ["diasAlmacenaje", String(cot.dias_almacenaje ?? 0)],
    ["seguro", Boolean(cot.seguro)],
    ["valorSeguroUsd", cot.valor_seguro_usd != null ? String(cot.valor_seguro_usd) : ""],
    ["notas", cot.notas ?? ""],
  ];
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Devuelve los pares [campo, valor] para aplicar a un formulario al vincular cotización. */
export function buildVincularCotizacionUpdates(
  cot: CotizacionParaVincular,
): Array<FieldUpdate> {
  return [
    ...buildMercanciaUpdates(cot),
    ...buildRutaUpdates(cot),
    ...buildOpcionalUpdates(cot),
    ...buildPackBUpdates(cot),
  ];
}

/**
 * Snapshot canonicalizado a partir de las actualizaciones aplicadas al vincular.
 * Permite que el caller no tenga que rastrear manualmente qué valores sembró.
 */
export function snapshotFromVincularUpdates(
  updates: Array<FieldUpdate>,
): VincularSnapshot {
  const snap: VincularSnapshot = {};
  for (const [field, value] of updates) snap[field] = value;
  return snap;
}

const DESVINCULAR_DEFAULTS: Array<FieldUpdate> = [
  ["clienteId", ""],
  ["modo", ""],
  ["tipo", ""],
  ["incoterm", "FOB"],
  ["descripcionMercancia", ""],
  ["tipoCarga", "Carga General"],
  ["tipoContenedor", ""],
  ["pesoKg", ""],
  ["volumenM3", ""],
  ["piezas", ""],
  ["puertoOrigen", ""],
  ["puertoDestino", ""],
  ["aeropuertoOrigen", ""],
  ["aeropuertoDestino", ""],
  ["ciudadOrigen", ""],
  ["ciudadDestino", ""],
  ["msdsArchivo", ""],
  ["contenedores", []],
  // Pack B+ defaults
  ["tarifaId", ""],
  ["cartaGarantia", false],
  ["diasLibresDestino", "0"],
  ["diasAlmacenaje", "0"],
  ["seguro", false],
  ["valorSeguroUsd", ""],
  ["notas", ""],
];

/**
 * Devuelve los pares [campo, valor] a aplicar al desvincular cotización.
 *
 * - `limpiar`: vacía todos los campos heredados. Si se pasa `snapshot` +
 *   `currentValues`, sólo se limpian los campos cuyo valor actual sigue
 *   siendo igual al snapshot (es decir, el usuario no los tocó). Los demás
 *   se respetan (Opción A).
 * - `conservar`: no toca campos del formulario, sólo se rompe el vínculo.
 * - `solo-conceptos`: el formulario queda intacto; el caller debe limpiar
 *    los conceptos por separado.
 */
export function buildDesvincularCotizacionUpdates(
  modo: DesvincularModo = "limpiar",
  snapshot?: VincularSnapshot,
  currentValues?: Partial<EmbarqueFormValues>,
): Array<FieldUpdate> {
  if (modo === "conservar" || modo === "solo-conceptos") return [];
  if (!snapshot || !currentValues) return DESVINCULAR_DEFAULTS;

  return DESVINCULAR_DEFAULTS.filter(([field]) => {
    if (!(field in snapshot)) return true; // campo no fue sembrado → limpiar default
    const snapVal = snapshot[field];
    const curVal = currentValues[field];
    // Igualdad estructural simple para strings/booleanos/arrays vacíos.
    if (Array.isArray(snapVal) && Array.isArray(curVal)) {
      return snapVal.length === curVal.length; // arrays: limpiar sólo si longitud intacta
    }
    return String(snapVal ?? "") === String(curVal ?? "");
  });
}
