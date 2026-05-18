/**
 * Servicio de facturas: queries del listado de facturas y operaciones sobre
 * conceptos de costo (gastos pendientes / marcar pagado).
 *
 * v8.173.0 (Ola B.4): `fetchFacturas` ahora consume el RPC `facturas_listado`
 * que devuelve filas + `proforma_numero` + `total_count` en una sola llamada
 * con paginación server-side. Se mantiene la forma `proformas: { numero }`
 * por compatibilidad con consumidores existentes.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type FacturaRow = Tables<"facturas">;

export { fetchFacturaSnapshot, fetchProformaSnapshot } from "./snapshots";
export type { FacturaSnapshot, ProformaSnapshot } from "./snapshots";
export {
  fetchLayoutContableData,
  fetchEstadoCuentaFacturas,
} from "./exports";
export type {
  LayoutContableData,
  LayoutContableRow,
  EstadoCuentaFactura,
} from "./exports";

export type FacturaListItem = Pick<
  FacturaRow,
  | "id" | "numero" | "cliente_nombre" | "expediente" | "total" | "moneda"
  | "fecha_emision" | "fecha_vencimiento" | "estado"
  | "proforma_id" | "factura_pdf_url" | "factura_xml_url"
> & {
  proformas: { numero: string } | null;
};

export interface FacturasListadoFilters {
  organizationId: string | null;
  search?: string;
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  pageSize?: number;
}

export interface FacturasListadoResult {
  data: FacturaListItem[];
  count: number;
}

export async function fetchFacturasListado(f: FacturasListadoFilters): Promise<FacturasListadoResult> {
  const page = f.page ?? 0;
  const pageSize = f.pageSize ?? 50;
  const { data, error } = await supabase.rpc("facturas_listado", {
    p_organization_id: f.organizationId ?? undefined,
    p_search: f.search || undefined,
    p_estado: f.estado && f.estado !== "todos" ? f.estado : undefined,
    p_fecha_desde: f.fechaDesde || undefined,
    p_fecha_hasta: f.fechaHasta || undefined,
    p_offset: page * pageSize,
    p_limit: pageSize,
  });
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    id: string; numero: string; cliente_nombre: string; expediente: string;
    total: number; moneda: FacturaRow["moneda"]; fecha_emision: string;
    fecha_vencimiento: string; estado: FacturaRow["estado"];
    proforma_id: string | null; proforma_numero: string | null;
    factura_pdf_url: string | null; factura_xml_url: string | null;
    total_count: number | string;
  }>;
  const count = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items: FacturaListItem[] = rows.map((r) => ({
    id: r.id,
    numero: r.numero,
    cliente_nombre: r.cliente_nombre,
    expediente: r.expediente,
    total: r.total,
    moneda: r.moneda,
    fecha_emision: r.fecha_emision,
    fecha_vencimiento: r.fecha_vencimiento,
    estado: r.estado,
    proforma_id: r.proforma_id,
    factura_pdf_url: r.factura_pdf_url,
    factura_xml_url: r.factura_xml_url,
    proformas: r.proforma_numero ? { numero: r.proforma_numero } : null,
  }));
  return { data: items, count };
}

/**
 * Mantiene la API histórica (devolver todas las facturas filtradas por org).
 * Internamente ahora pasa por `facturas_listado` con un límite alto para
 * preservar el comportamiento de los consumidores que paginan client-side.
 */
export async function fetchFacturas(organizationId: string | null): Promise<FacturaListItem[]> {
  const { data } = await fetchFacturasListado({ organizationId, page: 0, pageSize: 5000 });
  return data;
}

export async function marcarCostoPagado(input: { id: string; referenciaPago?: string }): Promise<void> {
  const { error } = await supabase
    .from("conceptos_costo")
    .update({
      estado_liquidacion: "Pagado",
      fecha_pago: new Date().toISOString().split("T")[0],
      referencia_pago: input.referenciaPago || null,
    })
    .eq("id", input.id);
  if (error) throw error;
}

export async function fetchGastosPendientes() {
  const { data, error } = await supabase
    .from("conceptos_costo")
    .select("*, embarques!conceptos_costo_embarque_id_fkey(expediente)")
    .eq("estado_liquidacion", "Pendiente")
    .order("fecha_vencimiento", { ascending: true });
  if (error) throw error;
  return data;
}
export type { FilaHueco, HuecoFacturacionResult } from './huecoFacturacion';
export { fetchHuecoFacturacion } from "./huecoFacturacion";
export { fetchProyeccionMes } from "./proyeccion";
export type { ProyeccionMesParams } from "./proyeccion";
