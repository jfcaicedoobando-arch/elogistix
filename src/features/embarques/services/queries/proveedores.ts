/**
 * Lectura ligera del catálogo de proveedores para selects y wizards.
 * Vive en `services/embarque` porque es donde se consume (conceptos costo).
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchProveedoresForSelect(organizationId: string | null) {
  // 12.34.0: .limit(500) defensivo (evita cap silencioso de 1000 PostgREST).
  let query = supabase
    .from("proveedores")
    .select("id, nombre")
    .is("deleted_at", null)
    .order("nombre")
    .limit(500);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export interface ProveedorDelEmbarque {
  id: string;
  nombre: string;
}

/**
 * Proveedores que ya aparecen en los costos vivos del embarque.
 * Se usa para que el operador escoja rápido al subir una factura al buzón.
 */
export async function fetchProveedoresDelEmbarque(
  embarqueId: string,
): Promise<ProveedorDelEmbarque[]> {
  const { data, error } = await supabase
    .from("conceptos_costo")
    .select("proveedor_id, proveedor_nombre")
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null)
    .limit(500);
  if (error) throw error;
  return dedupeProveedores(data ?? []);
}

/** Deduplica por id y ordena por nombre (locale MX). */
export function dedupeProveedores(
  filas: ReadonlyArray<{ proveedor_id: string | null; proveedor_nombre: string | null }>,
): ProveedorDelEmbarque[] {
  const mapa = new Map<string, string>();
  for (const fila of filas) {
    if (!fila.proveedor_id) continue;
    const previo = mapa.get(fila.proveedor_id);
    if (!previo || (!previo.trim() && fila.proveedor_nombre)) {
      mapa.set(fila.proveedor_id, fila.proveedor_nombre ?? "Proveedor sin nombre");
    }
  }
  return Array.from(mapa, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es-MX"),
  );
}

/**
 * v13.503.0 — Suma de costos vivos del embarque para un proveedor, agrupada por
 * moneda. Sirve para cotejar lo que facturó el proveedor contra lo costeado.
 */
export async function fetchCostosProveedorEmbarque(
  embarqueId: string,
  proveedorId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("conceptos_costo")
    .select("monto, moneda")
    .eq("embarque_id", embarqueId)
    .eq("proveedor_id", proveedorId)
    .is("deleted_at", null)
    .limit(500);
  if (error) throw error;
  return sumarPorMoneda(data ?? []);
}

/** Agrupa importes por moneda (helper puro, testeable). */
export function sumarPorMoneda(
  filas: ReadonlyArray<{ monto: number | null; moneda: string | null }>,
): Record<string, number> {
  const totales: Record<string, number> = {};
  for (const fila of filas) {
    const moneda = fila.moneda ?? "MXN";
    const monto = Number(fila.monto ?? 0);
    if (!Number.isFinite(monto)) continue;
    totales[moneda] = (totales[moneda] ?? 0) + monto;
  }
  return totales;
}

/** v13.506.0 — Concepto de costo del embarque ofrecido al subir al buzón. */
export interface ConceptoCostoEmbarque {
  id: string;
  concepto: string;
  monto: number;
  moneda: string;
  /** Ya lo cubre una factura de proveedor viva: no se debe volver a sugerir. */
  yaFacturado: boolean;
}

/**
 * v13.506.0 — Conceptos de costo vivos y pendientes del proveedor en ESE
 * embarque. El operador marca cuáles cubre el documento que sube al buzón.
 */
export async function fetchConceptosCostoEmbarqueProveedor(
  embarqueId: string,
  proveedorId: string,
): Promise<ConceptoCostoEmbarque[]> {
  const { data, error } = await supabase
    .from("conceptos_costo")
    .select("id, concepto, monto, moneda")
    .eq("embarque_id", embarqueId)
    .eq("proveedor_id", proveedorId)
    .eq("estado_liquidacion", "Pendiente")
    .is("deleted_at", null)
    .order("concepto")
    .limit(200);
  if (error) throw error;
  const conFactura = await fetchCostosConFactura(embarqueId);
  return (data ?? []).map((r) => ({
    id: r.id,
    concepto: r.concepto ?? "Concepto sin nombre",
    monto: Number(r.monto ?? 0),
    moneda: r.moneda ?? "MXN",
    yaFacturado: conFactura.has(r.id),
  }));
}

