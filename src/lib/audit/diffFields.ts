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
export function diffFields<T extends Record<string, unknown>>(
  before: Partial<T> | null | undefined,
  after: Partial<T>,
  fields?: ReadonlyArray<keyof T>,
): FieldDiff[] {
  if (!before) return [];
  const keys = (fields ?? (Object.keys(after) as Array<keyof T>)) as Array<keyof T>;
  const out: FieldDiff[] = [];
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    if (b === undefined) continue; // no se intentó actualizar
    if (equal(a, b)) continue;
    out.push({
      campo: String(k),
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
export function diffConceptos(
  before: ConceptoLike[] | null | undefined,
  after: ConceptoLike[] | null | undefined,
): ConceptosDiff {
  const b = before ?? [];
  const a = after ?? [];
  const mapBefore = new Map(b.map((c) => [keyOf(c), c]));
  const mapAfter = new Map(a.map((c) => [keyOf(c), c]));
  const out: ConceptosDiff = { agregados: 0, eliminados: 0, modificados: 0, detalle: [] };

  for (const [k, ca] of mapAfter) {
    const cb = mapBefore.get(k);
    if (!cb) {
      out.agregados += 1;
      out.detalle.push({ tipo: "agregado", concepto: (ca.concepto ?? ca.descripcion ?? "").trim(), despues: resumen(ca) });
    } else {
      const rb = resumen(cb);
      const ra = resumen(ca);
      if (rb !== ra || (cb.moneda ?? "") !== (ca.moneda ?? "")) {
        out.modificados += 1;
        out.detalle.push({ tipo: "modificado", concepto: (ca.concepto ?? ca.descripcion ?? "").trim(), antes: rb, despues: ra });
      }
    }
  }
  for (const [k, cb] of mapBefore) {
    if (!mapAfter.has(k)) {
      out.eliminados += 1;
      out.detalle.push({ tipo: "eliminado", concepto: (cb.concepto ?? cb.descripcion ?? "").trim(), antes: resumen(cb) });
    }
  }
  return out;
}
