/**
 * Consultas de la fuente devengada del Estado de Resultados: facturas, notas de
 * crédito, facturas de proveedor y embarques (por id o por expediente).
 *
 * Extraído de `estadoResultadosDevengado.ts` (límite Power-of-10 de 200 líneas).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr } from "@/lib/supabase/response";
import { FACTURA_ESTADOS_VIVOS } from "@/lib/domain/estadosFactura";
import type { EmbarqueER } from "@/features/profit/domain/estadoResultados";
import {
  mapFacturaRows,
  mapNotaCreditoRows,
  mapProveedorFacturaRows,
  mapEmbarqueERRows,
  mapEmbarqueERConExpediente,
  type FacturaRow,
  type NotaCreditoRow,
  type ProveedorFacturaRow,
} from "@/lib/mappers/estadoResultadosRows";

export async function loadEmbarquesPorIds(ids: string[]): Promise<EmbarqueER[]> {
  if (ids.length === 0) return [];
  const data = await unwrapOr(
    supabase
      .from("embarques")
      .select("id, modo, tipo_cambio_usd, tipo_cambio_eur")
      .in("id", ids)
      .is("deleted_at", null),
    [],
  );
  return mapEmbarqueERRows(data);
}

export async function loadEmbarquesPorExpedientes(
  exps: string[],
  organizationId: string | null,
): Promise<Map<string, EmbarqueER>> {
  if (exps.length === 0) return new Map();
  let q = supabase
    .from("embarques")
    .select("id, modo, tipo_cambio_usd, tipo_cambio_eur, expediente")
    .in("expediente", exps)
    .is("deleted_at", null);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const data = await unwrapOr(q, []);
  const map = new Map<string, EmbarqueER>();
  for (const e of mapEmbarqueERConExpediente(data)) {
    if (e.expediente) map.set(e.expediente, e);
  }
  return map;
}

export async function fetchFacturasMes(orgId: string | null, desde: string, hasta: string): Promise<FacturaRow[]> {
  let q = supabase
    .from("facturas")
    // BL-06: `subtotal` (sin IVA) en lugar de `total` (con IVA).
    .select("id, expediente, subtotal, moneda, fecha_emision, tipo_cambio")
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta)
    // Excluye Cancelada y Sustituida: ambas dejan de ser CFDI vigentes y no
    // deben sumar en el EERR devengado. Ref: FACTURA_ESTADOS_VIVOS.
    .in("estado", [...FACTURA_ESTADOS_VIVOS])
    .is("deleted_at", null);
  if (orgId) q = q.eq("organization_id", orgId);
  return mapFacturaRows(await unwrapOr(q, []));
}

export async function fetchNotasCreditoMes(orgId: string | null, desde: string, hasta: string): Promise<NotaCreditoRow[]> {
  let q = supabase
    .from("factura_notas_credito")
    // BL-10: ubicar la NC por su `fecha_emision` (DATE de negocio, inmutable),
    // no por `updated_at`: cualquier UPDATE posterior movía el reconocimiento a
    // otro mes y las fronteras naive T00:00:00/T23:59:59 se interpretaban en
    // UTC, desplazando 6 h las NCs de fin de mes (TZ MX). El rango YYYY-MM-DD
    // viene de `rangoMes`, igual que facturas.
    .select("monto, moneda, factura_id, fecha_emision, tipo_cambio")
    .eq("estado", "Aplicada")
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta)
    .is("deleted_at", null);
  if (orgId) q = q.eq("organization_id", orgId);
  return mapNotaCreditoRows(await unwrapOr(q, []));
}

export async function fetchProveedorFacturasMes(orgId: string | null, desde: string, hasta: string): Promise<ProveedorFacturaRow[]> {
  let q = supabase
    .from("proveedor_facturas")
    // BL-06: `subtotal` (sin IVA) en lugar de `total` (con IVA).
    .select("id, embarque_id, subtotal, moneda, fecha_emision, tipo_cambio_usd")
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta)
    .neq("estado", "Cancelada")
    .is("deleted_at", null);
  if (orgId) q = q.eq("organization_id", orgId);
  return mapProveedorFacturaRows(await unwrapOr(q, []));
}

