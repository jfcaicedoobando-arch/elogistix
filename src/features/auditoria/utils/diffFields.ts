/**
 * Bloque 3.6 — Diff de campos sensibles para auditoría.
 *
 * Calcula los campos que cambiaron entre `before` y `after`, normalizando
 * valores vacíos (null/undefined/"") como equivalentes. La salida es serializable
 * para guardarse en `bitacora_actividad.detalles` y consultarse después.
 */

export interface FieldDiff {
  campo: string;
  antes: string | number | boolean | null;
  despues: string | number | boolean | null;
}

type Primitive = string | number | boolean | null | undefined;

function normalize(v: unknown): Primitive {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  if (typeof v === "number" || typeof v === "boolean") return v;
  // Para objetos/arrays los serializamos para comparar igualdad simple.
  return JSON.stringify(v);
}

function equal(a: unknown, b: unknown): boolean {
  return normalize(a) === normalize(b);
}

/**
 * Devuelve solo los campos cuyo valor cambió entre `before` y `after`,
 * limitando a la lista de `fields` (para evitar registrar timestamps,
 * `updated_at`, etc.). Si `fields` se omite, se comparan todas las claves de
 * `after`.
 */
export function diffFields<T extends object>(
  before: T | Partial<T> | null | undefined,
  after: Partial<T>,
  fields?: ReadonlyArray<string>,
): FieldDiff[] {
  if (!before) return [];
  const beforeRec = before as Record<string, unknown>;
  const afterRec = after as Record<string, unknown>;
  const keys = (fields ?? (Object.keys(after) as Array<keyof T & string>)) as ReadonlyArray<string>;
  const out: FieldDiff[] = [];
  for (const k of keys) {
    const a = beforeRec[k];
    const b = afterRec[k];
    if (b === undefined) continue; // no se intentó actualizar
    if (equal(a, b)) continue;
    out.push({
      campo: k,
      antes: normalize(a) as FieldDiff["antes"],
      despues: normalize(b) as FieldDiff["despues"],
    });
  }
  return out;
}

/** Campos sensibles por entidad — la fuente única de verdad para la bitácora. */
export const SENSITIVE_FIELDS = {
  cliente: [
    "nombre",
    "rfc",
    "email",
    "telefono",
    "contacto",
    "direccion",
    "ciudad",
    "estado",
    "cp",
    "dias_credito",
    "limite_credito_mxn",
    "regimen_fiscal",
    "uso_cfdi_default",
  ] as const,
  proveedor: [
    "nombre",
    "rfc",
    "email",
    "telefono",
    "contacto",
    "moneda_preferida",
    "pais",
    "tipo",
  ] as const,
  embarque_costo: [
    "concepto",
    "monto",
    "moneda",
    "proveedor_id",
    "estado_liquidacion",
  ] as const,
  embarque_venta: [
    "concepto",
    "monto",
    "moneda",
    "estado_facturacion",
  ] as const,
  embarque: [
    "cliente_id",
    "modo",
    "tipo",
    "incoterm",
    "naviera",
    "contenedor",
    "bl_master",
    "bl_house",
    "puerto_origen",
    "puerto_destino",
    "etd",
    "eta",
    "estado",
    "consignatario_id",
    "notificar_id",
  ] as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Diff de arreglos de conceptos (costos/ventas de embarque).
// ─────────────────────────────────────────────────────────────────────────────

export interface ConceptoLike {
  concepto?: string | null;
  descripcion?: string | null;
  monto?: number | string | null;
  precio_unitario?: number | string | null;
  cantidad?: number | string | null;
  moneda?: string | null;
  proveedor_id?: string | null;
}

export interface ConceptosDiff {
  agregados: number;
  eliminados: number;
  modificados: number;
  detalle: Array<{ tipo: "agregado" | "eliminado" | "modificado"; concepto: string; antes?: string; despues?: string }>;
}

function keyOf(c: ConceptoLike): string {
  const nombre = (c.concepto ?? c.descripcion ?? "").trim().toLowerCase();
  const prov = c.proveedor_id ?? "";
  return `${nombre}|${prov}`;
}

function montoTotal(c: ConceptoLike): number {
  if (c.monto != null) return Number(c.monto) || 0;
  const pu = Number(c.precio_unitario ?? 0) || 0;
  const qty = Number(c.cantidad ?? 1) || 1;
  return pu * qty;
}

function resumen(c: ConceptoLike): string {
  return `${montoTotal(c).toFixed(2)} ${c.moneda ?? ""}`.trim();
}

/**
 * Compara dos listas de conceptos (venta o costo) y devuelve un resumen
 * cuantitativo + detalle de cambios. Empareja por (concepto, proveedor_id).
 */
function nombreOf(c: ConceptoLike): string {
  return (c.concepto ?? c.descripcion ?? "").trim();
}

function compararConcepto(cb: ConceptoLike, ca: ConceptoLike, out: ConceptosDiff): void {
  const rb = resumen(cb);
  const ra = resumen(ca);
  if (rb === ra && (cb.moneda ?? "") === (ca.moneda ?? "")) return;
  out.modificados += 1;
  out.detalle.push({ tipo: "modificado", concepto: nombreOf(ca), antes: rb, despues: ra });
}

function agruparPorClave(lista: ConceptoLike[] | null | undefined): Map<string, ConceptoLike[]> {
  const out = new Map<string, ConceptoLike[]>();
  for (const c of lista ?? []) {
    const k = keyOf(c);
    const bucket = out.get(k);
    if (bucket) bucket.push(c);
    else out.set(k, [c]);
  }
  return out;
}

function diffBucket(antes: ConceptoLike[], despues: ConceptoLike[], out: ConceptosDiff): void {
  const comunes = Math.min(antes.length, despues.length);
  for (let i = 0; i < comunes; i += 1) compararConcepto(antes[i], despues[i], out);
  for (let i = comunes; i < despues.length; i += 1) {
    out.agregados += 1;
    out.detalle.push({ tipo: "agregado", concepto: nombreOf(despues[i]), despues: resumen(despues[i]) });
  }
  for (let i = comunes; i < antes.length; i += 1) {
    out.eliminados += 1;
    out.detalle.push({ tipo: "eliminado", concepto: nombreOf(antes[i]), antes: resumen(antes[i]) });
  }
}

export function diffConceptos(
  before: ConceptoLike[] | null | undefined,
  after: ConceptoLike[] | null | undefined,
): ConceptosDiff {
  // Se agrupa por clave en listas (no en un Map de 1 elemento): un embarque
  // puede tener varios conceptos con el mismo nombre y proveedor (p. ej. dos
  // "Demoras"), y antes se colapsaban y la bitácora reportaba 1 eliminado
  // cuando en realidad se habían quitado 2.
  const mapBefore = agruparPorClave(before);
  const mapAfter = agruparPorClave(after);
  const out: ConceptosDiff = { agregados: 0, eliminados: 0, modificados: 0, detalle: [] };

  for (const [k, despues] of mapAfter) {
    diffBucket(mapBefore.get(k) ?? [], despues, out);
  }
  for (const [k, antes] of mapBefore) {
    if (mapAfter.has(k)) continue;
    diffBucket(antes, [], out);
  }
  return out;
}

