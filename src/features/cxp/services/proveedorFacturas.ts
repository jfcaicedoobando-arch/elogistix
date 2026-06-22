/**
 * Services CxP — Cuentas por Pagar a proveedores.
 *
 * Lista facturas de proveedor con saldo calculado (vía v_proveedor_facturas_saldo),
 * KPIs (por pagar / vencido / por vencer 7d) y CRUD básico.
 *
 * Lógica pura (clasificación, mapeo, filtros cliente) en `./proveedorFacturas.helpers`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import {
  PROVEEDOR_FACTURAS_SELECT,
  mapJoinedRow,
  aplicarFiltrosCliente,
  type Joined,
} from "./proveedorFacturas.helpers";

export type ProveedorFacturaRow = Tables<"proveedor_facturas">;
export type EstadoProveedorFactura = ProveedorFacturaRow["estado"];
export type EstatusCxP = "Vigente" | "Por vencer" | "Vencida" | "Pagada" | "Sin saldo";

export interface FacturaCxP {
  id: string;
  proveedor_id: string;
  proveedor_nombre: string;
  proveedor_origen: "Nacional" | "Extranjero" | null;
  embarque_id: string | null;
  folio_proveedor: string;
  folio_interno: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  dias_vencido: number;
  moneda: ProveedorFacturaRow["moneda"];
  total: number;
  pagado: number;
  notas_credito: number;
  saldo: number;
  estado: EstadoProveedorFactura;
  estatus: EstatusCxP;
  tipo_cambio_usd: number;
  estado_aprobacion: "pendiente" | "aprobada" | "rechazada";
  motivo_rechazo: string | null;
  categoria_presupuesto_id: string | null;
  categoria_nombre: string | null;
  subtotal: number;
  iva: number;
  retenciones: number;
  rfc_proveedor: string | null;
  uuid_fiscal: string | null;
  dias_credito: number | null;
  notas: string | null;
}


export interface FetchCxPFiltros {
  search?: string;
  proveedor_id?: string;
  moneda?: ProveedorFacturaRow["moneda"] | "todas";
  estatus?: EstatusCxP | "todos";
  origen?: "Nacional" | "Extranjero" | "todos";
  aprobacion?: "todos" | "pendiente" | "aprobada" | "rechazada";
  categoria_presupuesto_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

export async function fetchFacturasCxP(filtros: FetchCxPFiltros = {}): Promise<FacturaCxP[]> {
  let q = supabase
    .from("proveedor_facturas")
    .select(PROVEEDOR_FACTURAS_SELECT)
    .neq("estado", "Cancelada")
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
    .limit(2000);

  if (filtros.proveedor_id && filtros.proveedor_id !== "todos") q = q.eq("proveedor_id", filtros.proveedor_id);
  if (filtros.categoria_presupuesto_id && filtros.categoria_presupuesto_id !== "todas") {
    q = q.eq("categoria_presupuesto_id", filtros.categoria_presupuesto_id);
  }
  if (filtros.moneda && filtros.moneda !== "todas") q = q.eq("moneda", filtros.moneda);
  if (filtros.fecha_desde) q = q.gte("fecha_emision", filtros.fecha_desde);
  if (filtros.fecha_hasta) q = q.lte("fecha_emision", filtros.fecha_hasta);
  if (filtros.search) {
    q = q.or(`folio_interno.ilike.%${filtros.search}%,folio_proveedor.ilike.%${filtros.search}%,proveedor_nombre.ilike.%${filtros.search}%`);
  }

  const { data, error } = await q;
  if (error) throw error;

  // SAFE-CAST: tipo `Joined` modela el shape del select con embeds; Supabase devuelve unknown.
  const rows = ((data as unknown as Joined[] | null) ?? []).map(mapJoinedRow);

  return aplicarFiltrosCliente(rows, filtros);
}

/**
 * Lee una factura individual con el mismo shape `FacturaCxP` que la lista.
 * Permite que el diálogo de detalle observe datos frescos vía React Query
 * aunque la lista filtrada haya descartado la fila (p.ej. al cambiar el
 * estado_aprobacion de "pendiente" a "aprobada" bajo el filtro "Por aprobar").
 */
export async function fetchFacturaProveedor(id: string): Promise<FacturaCxP | null> {
  const { data, error } = await supabase
    .from("proveedor_facturas")
    .select(PROVEEDOR_FACTURAS_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // SAFE-CAST: mismo shape `Joined` validado por el select de arriba.
  return mapJoinedRow(data as unknown as Joined);
}

export { calcularKPIsCxP, type KPIsCxP } from "./cxpKpis";

// folio_interno se asigna en el trigger BEFORE INSERT de la BD; el caller no lo manda.
export type NuevaFacturaProveedorPayload =
  Omit<TablesInsert<"proveedor_facturas">, "folio_interno"> & { folio_interno?: string };

export async function crearFacturaProveedor(payload: NuevaFacturaProveedorPayload) {
  const { data, error } = await supabase
    .from("proveedor_facturas")
    .insert(payload as TablesInsert<"proveedor_facturas">)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Verifica si ya existe una factura con el mismo proveedor + folio + fecha emisión
 * (excluyendo canceladas y borradas). Bloquea capturas duplicadas accidentales.
 */
export async function existeFacturaDuplicada(
  proveedorId: string,
  folioProveedor: string,
  fechaEmision: string,
  excluirId?: string,
): Promise<boolean> {
  let q = supabase
    .from("proveedor_facturas")
    .select("id")
    .eq("proveedor_id", proveedorId)
    .eq("folio_proveedor", folioProveedor.trim())
    .eq("fecha_emision", fechaEmision)
    .neq("estado", "Cancelada")
    .is("deleted_at", null)
    .limit(1);
  if (excluirId) q = q.neq("id", excluirId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function softDeleteFacturaProveedor(id: string, userId: string | null) {
  const { error } = await supabase
    .from("proveedor_facturas")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
}

