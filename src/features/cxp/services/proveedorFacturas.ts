/**
 * Services CxP — Cuentas por Pagar a proveedores.
 *
 * Lista facturas de proveedor con saldo calculado (vía v_proveedor_facturas_saldo),
 * KPIs (por pagar / vencido / por vencer 7d) y CRUD básico.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

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
}

export interface FetchCxPFiltros {
  search?: string;
  proveedor_id?: string;
  moneda?: ProveedorFacturaRow["moneda"] | "todas";
  estatus?: EstatusCxP | "todos";
  origen?: "Nacional" | "Extranjero" | "todos";
  aprobacion?: "todos" | "pendiente" | "aprobada" | "rechazada";
  fecha_desde?: string;
  fecha_hasta?: string;
}

function diasVencido(fechaVenc: string | null): number {
  if (!fechaVenc) return 0;
  const venc = new Date(fechaVenc + "T00:00:00");
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy.getTime() - venc.getTime()) / 86_400_000);
}

function clasificar(saldo: number, dias: number, estado: EstadoProveedorFactura): EstatusCxP {
  if (estado === "Pagada") return "Pagada";
  if (saldo <= 0.01) return "Sin saldo";
  if (dias > 0) return "Vencida";
  if (dias >= -3) return "Por vencer";
  return "Vigente";
}

type Joined = Pick<
  ProveedorFacturaRow,
  | "id" | "proveedor_id" | "proveedor_nombre" | "embarque_id" | "folio_proveedor"
  | "fecha_emision" | "fecha_vencimiento" | "moneda" | "total" | "estado" | "tipo_cambio_usd"
  | "estado_aprobacion" | "motivo_rechazo"
> & {
  pagos_proveedor: Array<{ monto: number; deleted_at: string | null }> | null;
  proveedor_notas_credito: Array<{ monto: number; estado: string; deleted_at: string | null }> | null;
  proveedores: { origen_proveedor: "Nacional" | "Extranjero" | null } | null;
};

export async function fetchFacturasCxP(filtros: FetchCxPFiltros = {}): Promise<FacturaCxP[]> {
  let q = supabase
    .from("proveedor_facturas")
    .select(`
      id, proveedor_id, proveedor_nombre, embarque_id, folio_proveedor,
      fecha_emision, fecha_vencimiento, moneda, total, estado, tipo_cambio_usd,
      estado_aprobacion, motivo_rechazo,
      pagos_proveedor(monto, deleted_at),
      proveedor_notas_credito(monto, estado, deleted_at),
      proveedores(origen_proveedor)
    `)
    .neq("estado", "Cancelada")
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
    .limit(2000);

  if (filtros.proveedor_id && filtros.proveedor_id !== "todos") q = q.eq("proveedor_id", filtros.proveedor_id);
  if (filtros.moneda && filtros.moneda !== "todas") q = q.eq("moneda", filtros.moneda);
  if (filtros.fecha_desde) q = q.gte("fecha_emision", filtros.fecha_desde);
  if (filtros.fecha_hasta) q = q.lte("fecha_emision", filtros.fecha_hasta);
  if (filtros.search) {
    q = q.or(`folio_proveedor.ilike.%${filtros.search}%,proveedor_nombre.ilike.%${filtros.search}%`);
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
    .select(`
      id, proveedor_id, proveedor_nombre, embarque_id, folio_proveedor,
      fecha_emision, fecha_vencimiento, moneda, total, estado, tipo_cambio_usd,
      estado_aprobacion, motivo_rechazo,
      pagos_proveedor(monto, deleted_at),
      proveedor_notas_credito(monto, estado, deleted_at),
      proveedores(origen_proveedor)
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // SAFE-CAST: mismo shape `Joined` validado por el select de arriba.
  return mapJoinedRow(data as unknown as Joined);
}

function mapJoinedRow(f: Joined): FacturaCxP {
  const pagado = (f.pagos_proveedor ?? [])
    .filter(p => !p.deleted_at)
    .reduce((s, p) => s + Number(p.monto), 0);
  const nc = (f.proveedor_notas_credito ?? [])
    .filter(n => !n.deleted_at && n.estado === "Aplicada")
    .reduce((s, n) => s + Number(n.monto), 0);
  const total = Number(f.total);
  const saldo = Math.max(0, total - pagado - nc);
  // Una factura ya pagada (o sin saldo) nunca debe mostrar días vencidos.
  const yaSaldada = f.estado === "Pagada" || saldo <= 0.01;
  const dv = yaSaldada ? 0 : diasVencido(f.fecha_vencimiento);
  return {
    id: f.id,
    proveedor_id: f.proveedor_id,
    proveedor_nombre: f.proveedor_nombre,
    proveedor_origen: f.proveedores?.origen_proveedor ?? null,
    embarque_id: f.embarque_id,
    folio_proveedor: f.folio_proveedor,
    fecha_emision: f.fecha_emision,
    fecha_vencimiento: f.fecha_vencimiento,
    dias_vencido: Math.max(0, dv),
    moneda: f.moneda,
    total,
    pagado,
    notas_credito: nc,
    saldo,
    estado: f.estado,
    estatus: clasificar(saldo, dv, f.estado),
    tipo_cambio_usd: Number(f.tipo_cambio_usd),
    estado_aprobacion: f.estado_aprobacion,
    motivo_rechazo: f.motivo_rechazo,
  };
}

function aplicarFiltrosCliente(rows: FacturaCxP[], filtros: FetchCxPFiltros): FacturaCxP[] {
  let r = rows;
  if (filtros.estatus && filtros.estatus !== "todos") r = r.filter(x => x.estatus === filtros.estatus);
  if (filtros.origen && filtros.origen !== "todos") r = r.filter(x => x.proveedor_origen === filtros.origen);
  if (filtros.aprobacion && filtros.aprobacion !== "todos") r = r.filter(x => x.estado_aprobacion === filtros.aprobacion);
  return r;
}

export { calcularKPIsCxP, type KPIsCxP } from "./cxpKpis";

export async function crearFacturaProveedor(payload: TablesInsert<"proveedor_facturas">) {
  const { data, error } = await supabase
    .from("proveedor_facturas")
    .insert(payload)
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
): Promise<boolean> {
  const { data, error } = await supabase
    .from("proveedor_facturas")
    .select("id")
    .eq("proveedor_id", proveedorId)
    .eq("folio_proveedor", folioProveedor.trim())
    .eq("fecha_emision", fechaEmision)
    .neq("estado", "Cancelada")
    .is("deleted_at", null)
    .limit(1);
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


