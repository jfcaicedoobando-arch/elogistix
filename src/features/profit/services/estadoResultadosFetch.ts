/**
 * Consultas de la fuente devengada del Estado de Resultados: facturas, notas de
 * crédito, facturas de proveedor y embarques (por id o por expediente).
 *
 * Extraído de `estadoResultadosDevengado.ts` (límite Power-of-10 de 200 líneas).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr } from "@/lib/supabase/response";
import { FACTURA_ESTADOS_VIVOS } from "@/lib/domain/estadosFactura";
import { fechaFiscalFactura } from "@/features/profit/domain/fechaFiscalFactura";

import type { EmbarqueER } from "@/features/profit/domain/estadoResultados";
import {
  mapFacturaRows,
  mapNotaCreditoRows,
  mapProveedorFacturaRows,
  mapProveedorNotaCreditoRows,
  mapEmbarqueERRows,
  mapEmbarqueERConExpediente,
  type FacturaRow,
  type NotaCreditoRow,
  type ProveedorFacturaRow,
  type ProveedorNotaCreditoRow,
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
  const duplicados = new Set<string>();
  for (const e of mapEmbarqueERConExpediente(data)) {
    if (!e.expediente) continue;
    // EERR-DUP (v13.823.246): si dos embarques vivos comparten expediente no se
    // puede saber a cuál pertenece la factura. Antes ganaba el último de la
    // consulta y el importe se cargaba a un modo posiblemente equivocado; ahora
    // se deja sin vínculo y cae en "Otros".
    if (map.has(e.expediente)) duplicados.add(e.expediente);
    map.set(e.expediente, e);
  }
  for (const exp of duplicados) map.delete(exp);
  return map;
}


/** Días de holgura al consultar: el timbre puede caer el día antes/después. */
const HOLGURA_DIAS = 2;

function corre(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function fetchFacturasMes(orgId: string | null, desde: string, hasta: string): Promise<FacturaRow[]> {
  let q = supabase
    .from("facturas")
    // BL-06: `subtotal` (sin IVA) en lugar de `total` (con IVA).
    .select("id, expediente, subtotal, moneda, fecha_emision, timbrado_en, tipo_cambio")
    // EERR-FISCAL (v13.823.247): el mes se decide por la fecha de certificación
    // ante el SAT (`timbrado_en`, hora MX) cuando existe; `fecha_emision` es la
    // fecha capturada antes de enviar al PAC y puede quedar en otro día. Se
    // consulta con holgura y se filtra por la fecha fiscal.
    .gte("fecha_emision", corre(desde, -HOLGURA_DIAS))
    .lte("fecha_emision", corre(hasta, HOLGURA_DIAS))
    // Excluye Cancelada y Sustituida: ambas dejan de ser CFDI vigentes y no
    // deben sumar en el EERR devengado. Ref: FACTURA_ESTADOS_VIVOS.
    .in("estado", [...FACTURA_ESTADOS_VIVOS])
    .is("deleted_at", null);
  if (orgId) q = q.eq("organization_id", orgId);
  const filas = mapFacturaRows(await unwrapOr(q, []));
  return filas.filter((f) => {
    const fecha = fechaFiscalFactura(f);
    return fecha >= desde && fecha <= hasta;
  });
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
    // EERR-APROB (v13.823.246): una factura de proveedor rechazada no es costo;
    // antes sólo se excluían las canceladas y el costo del mes quedaba inflado.
    .neq("estado_aprobacion", "rechazada")
    .is("deleted_at", null);
  if (orgId) q = q.eq("organization_id", orgId);
  return mapProveedorFacturaRows(await unwrapOr(q, []));
}

/**
 * EERR-NCP: notas de crédito de proveedor aplicadas en el mes (restan costo).
 * `proveedor_notas_credito` usa `fecha` como fecha de negocio (DATE).
 */
export async function fetchProveedorNotasCreditoMes(
  orgId: string | null,
  desde: string,
  hasta: string,
): Promise<ProveedorNotaCreditoRow[]> {
  let q = supabase
    .from("proveedor_notas_credito")
    .select("id, proveedor_factura_id, monto, moneda, fecha, tipo_cambio")
    .eq("estado", "Aplicada")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .is("deleted_at", null);
  if (orgId) q = q.eq("organization_id", orgId);
  return mapProveedorNotaCreditoRows(await unwrapOr(q, []));
}

/** `proveedor_factura_id` → `embarque_id` para ubicar el modo de cada NC. */
export async function loadEmbarqueIdsPorFacturaProveedor(
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const data = await unwrapOr(
    supabase
      .from("proveedor_facturas")
      .select("id, embarque_id")
      .in("id", ids)
      .is("deleted_at", null),
    [],
  );
  for (const row of (data ?? []) as { id: string; embarque_id: string | null }[]) {
    if (row.embarque_id) out.set(row.id, row.embarque_id);
  }
  return out;
}


