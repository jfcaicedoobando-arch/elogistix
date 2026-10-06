/**
 * Consultas de la fuente devengada del Estado de Resultados: facturas, notas de
 * crédito, facturas de proveedor y embarques (por id o por expediente).
 *
 * Extraído de `estadoResultadosDevengado.ts` (límite Power-of-10 de 200 líneas).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap } from "@/lib/supabase/response";
import { FACTURA_ESTADOS_VIVOS, NC_CLIENTE_ESTADOS_VIGENTES } from "@/lib/domain/estadosFactura";
import { fechaFiscalFactura } from "@/features/profit/domain/fechaFiscalFactura";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";
import { fetchInChunks } from "@/lib/supabase/chunkedIn";

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
  const data = await fetchInChunks(ids, async (lote) => (await unwrap(
    supabase
      .from("embarques")
      .select("id, modo, tipo_cambio_usd, tipo_cambio_eur")
      .in("id", lote)
      .is("deleted_at", null),
  )) ?? []);
  return mapEmbarqueERRows(data);
}

export async function loadEmbarquesPorExpedientes(
  exps: string[],
  organizationId: string | null,
): Promise<Map<string, EmbarqueER>> {
  if (exps.length === 0) return new Map();
  const data = await fetchInChunks(exps, (lote) => leerTodasLasPaginas("profit.embarquesExpedientes", (ini, fin) => {
    let q = supabase
      .from("embarques")
      .select("id, modo, tipo_cambio_usd, tipo_cambio_eur, expediente")
      .in("expediente", lote)
      .is("deleted_at", null);
    if (organizationId) q = q.eq("organization_id", organizationId);
    return q.order("id").range(ini, fin);
  }));
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
  // AUD-ANALISIS-4: lectura por páginas; sin ella un mes >1000 facturas se
  // truncaba en silencio.
  const crudas = await leerTodasLasPaginas("profit.facturasMes", (ini, fin) => {
    let q = supabase
    .from("facturas")
    // BL-06: `subtotal` (sin IVA) en lugar de `total` (con IVA).
    .select("id, expediente, subtotal, moneda, fecha_emision, timbrado_en, tipo_cambio")
    // EERR-FISCAL (v13.823.247): el mes se decide por la fecha de certificación
    // ante el SAT (`timbrado_en`, hora MX) cuando existe; `fecha_emision` es la
    // fecha capturada antes de enviar al PAC y puede quedar en otro día.
    // EERR-HUECO (v13.823.263): una factura capturada días antes y timbrada ya
    // dentro del mes (p. ej. captura 25-ago, timbre 3-sep) quedaba huérfana:
    // fuera de la holgura de emisión de septiembre y fuera de agosto por su
    // fecha fiscal. La consulta cubre AMBOS orígenes: emisión con holgura o
    // timbrado dentro del mes; el filtro en memoria por fecha fiscal decide.
    .or(
      `and(fecha_emision.gte.${corre(desde, -HOLGURA_DIAS)},fecha_emision.lte.${corre(hasta, HOLGURA_DIAS)}),` +
        // AUD-ANALISIS-6: fronteras del timbre en hora de México (UTC-6), no UTC.
        `and(timbrado_en.gte.${desde}T00:00:00-06:00,timbrado_en.lte.${hasta}T23:59:59.999-06:00)`,
    )
    // Excluye Cancelada y Sustituida: ambas dejan de ser CFDI vigentes y no
    // deben sumar en el EERR devengado. Ref: FACTURA_ESTADOS_VIVOS.
    .in("estado", [...FACTURA_ESTADOS_VIVOS])
    .is("deleted_at", null);
    if (orgId) q = q.eq("organization_id", orgId);
    return q.order("id").range(ini, fin);
  });
  const filas = mapFacturaRows(crudas);
  return filas.filter((f) => {
    const fecha = fechaFiscalFactura(f);
    return fecha >= desde && fecha <= hasta;
  });
}


export async function fetchNotasCreditoMes(orgId: string | null, desde: string, hasta: string): Promise<NotaCreditoRow[]> {
  const data = await leerTodasLasPaginas("profit.notasCreditoMes", (ini, fin) => {
    let q = supabase
      .from("factura_notas_credito")
    // BL-10: ubicar la NC por su `fecha_emision` (DATE de negocio, inmutable),
    // no por `updated_at`: cualquier UPDATE posterior movía el reconocimiento a
    // otro mes y las fronteras naive T00:00:00/T23:59:59 se interpretaban en
    // UTC, desplazando 6 h las NCs de fin de mes (TZ MX). El rango YYYY-MM-DD
    // viene de `rangoMes`, igual que facturas.
      // La NC sólo reconoce un padre vivo, aunque su factura sea de otro periodo.
      .select("id, folio, monto, conceptos, moneda, factura_id, fecha_emision, tipo_cambio, facturas!inner(id)")
      .in("estado", [...NC_CLIENTE_ESTADOS_VIGENTES])
      .gte("fecha_emision", desde)
      .lte("fecha_emision", hasta)
      .is("deleted_at", null)
      .is("facturas.deleted_at", null);
    if (orgId) q = q.eq("organization_id", orgId);
    return q.order("id").range(ini, fin);
  });
  return mapNotaCreditoRows(data);
}

export async function fetchProveedorFacturasMes(orgId: string | null, desde: string, hasta: string): Promise<ProveedorFacturaRow[]> {
  const data = await leerTodasLasPaginas("profit.proveedorFacturasMes", (ini, fin) => {
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
    return q.order("id").range(ini, fin);
  });
  return mapProveedorFacturaRows(data);
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
  const data = await leerTodasLasPaginas("profit.proveedorNotasCreditoMes", (ini, fin) => {
    let q = supabase
      .from("proveedor_notas_credito")
      .select("id, proveedor_factura_id, monto, subtotal, moneda, fecha, tipo_cambio, tipo_cambio_mxn, proveedor_facturas!inner(id, moneda, tipo_cambio_usd)")
      .eq("estado", "Aplicada")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .is("deleted_at", null)
      .is("proveedor_facturas.deleted_at", null);
    if (orgId) q = q.eq("organization_id", orgId);
    return q.order("id").range(ini, fin);
  });
  return mapProveedorNotaCreditoRows(data);
}

/** `proveedor_factura_id` → `embarque_id` para ubicar el modo de cada NC. */
export async function loadEmbarqueIdsPorFacturaProveedor(
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const data = await fetchInChunks(ids, async (lote) => (await unwrap(
    supabase
      .from("proveedor_facturas")
      .select("id, embarque_id")
      .in("id", lote)
      .is("deleted_at", null),
  )) ?? []);
  for (const row of (data ?? []) as { id: string; embarque_id: string | null }[]) {
    if (row.embarque_id) out.set(row.id, row.embarque_id);
  }
  return out;
}


