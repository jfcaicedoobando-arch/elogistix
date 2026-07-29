/**
 * Servicio de facturas: listado paginado y operaciones sobre conceptos de costo.
 * Extraído de `index.ts` (Auditoría Paso 2: purga de barrels).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";
import type { Tables } from "@/integrations/supabase/types";


export type FacturaRow = Tables<"facturas">;

export type FacturaListItem = Pick<
  FacturaRow,
  | "id" | "numero" | "cliente_nombre" | "expediente" | "total" | "moneda"
  | "fecha_emision" | "fecha_vencimiento" | "estado"
  | "proforma_id" | "factura_pdf_url" | "factura_xml_url" | "ambiente"
  | "acuse_cancelacion_status" | "cancellation_status"
> & {
  proformas: { numero: string } | null;
  /** QW3 Tanda 1 — timestamp del último envío por correo al cliente. */
  enviada_cliente_at: string | null;
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
  const data = await unwrap(
    supabase.rpc("facturas_listado", {
      p_organization_id: f.organizationId ?? undefined,
      p_search: f.search || undefined,
      p_estado: f.estado && f.estado !== "todos" ? f.estado : undefined,
      p_fecha_desde: f.fechaDesde || undefined,
      p_fecha_hasta: f.fechaHasta || undefined,
      p_offset: page * pageSize,
      p_limit: pageSize,
    }),
  );
  const rows = (data ?? []) as Array<{
    id: string; numero: string; cliente_nombre: string; expediente: string;
    total: number; moneda: FacturaRow["moneda"]; fecha_emision: string;
    fecha_vencimiento: string; estado: FacturaRow["estado"];
    proforma_id: string | null; proforma_numero: string | null;
    factura_pdf_url: string | null; factura_xml_url: string | null;
    ambiente: FacturaRow["ambiente"];
    acuse_cancelacion_status: string | null;
    cancellation_status: string | null;
    enviada_cliente_at: string | null;
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
    ambiente: r.ambiente,
    acuse_cancelacion_status: r.acuse_cancelacion_status,
    cancellation_status: r.cancellation_status ?? null,
    enviada_cliente_at: r.enviada_cliente_at ?? null,
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
  await run(
    supabase
      .from("conceptos_costo")
      .update({
        estado_liquidacion: "Pagado",
        fecha_pago: new Date().toISOString().split("T")[0],
        referencia_pago: input.referenciaPago || null,
      })
      .eq("id", input.id),
  );
}

// FIX C3 (S6-09): cap explícito verificado por assertNotTruncated.
const LIMITE_GASTOS_PENDIENTES = 2000;

export async function fetchGastosPendientes() {
  const filas = await unwrapOr(
    supabase
      .from("conceptos_costo")
      .select("*, embarques!conceptos_costo_embarque_id_fkey(expediente)")
      .eq("estado_liquidacion", "Pendiente")
      .order("fecha_vencimiento", { ascending: true })
      .limit(LIMITE_GASTOS_PENDIENTES),
    [],
  );
  return assertNotTruncated(filas, LIMITE_GASTOS_PENDIENTES, "facturacion.fetchGastosPendientes");
}

