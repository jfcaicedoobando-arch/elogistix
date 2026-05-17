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
} as const;
