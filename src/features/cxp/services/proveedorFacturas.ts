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
}

export interface FetchCxPFiltros {
  search?: string;
  proveedor_id?: string;
  moneda?: ProveedorFacturaRow["moneda"] | "todas";
  estatus?: EstatusCxP | "todos";
  origen?: "Nacional" | "Extranjero" | "todos";
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
  const rows = ((data as unknown as Joined[] | null) ?? []).map((f): FacturaCxP => {
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
    };
  });

  let filtradas = rows;
  if (filtros.estatus && filtros.estatus !== "todos") {
    filtradas = filtradas.filter(r => r.estatus === filtros.estatus);
  }
  if (filtros.origen && filtros.origen !== "todos") {
    filtradas = filtradas.filter(r => r.proveedor_origen === filtros.origen);
  }
  return filtradas;
}

export interface KPIsCxP {
  por_pagar_mxn: number;
  por_pagar_usd: number;
  vencido_mxn: number;
  vencido_usd: number;
  por_vencer_7d_mxn: number;
  por_vencer_7d_usd: number;
  facturas_vencidas: number;
}

export function calcularKPIsCxP(filas: FacturaCxP[]): KPIsCxP {
  const k: KPIsCxP = {
    por_pagar_mxn: 0, por_pagar_usd: 0,
    vencido_mxn: 0, vencido_usd: 0,
    por_vencer_7d_mxn: 0, por_vencer_7d_usd: 0,
    facturas_vencidas: 0,
  };
  for (const f of filas) {
    if (f.saldo <= 0) continue;
    const usd = f.moneda === "USD";
    if (usd) k.por_pagar_usd += f.saldo; else k.por_pagar_mxn += f.saldo;
    if (f.estatus === "Vencida") {
      k.facturas_vencidas++;
      if (usd) k.vencido_usd += f.saldo; else k.vencido_mxn += f.saldo;
    }
    if (f.dias_vencido === 0 && f.fecha_vencimiento) {
      const dv = diasVencido(f.fecha_vencimiento);
      if (dv >= -7 && dv <= 0) {
        if (usd) k.por_vencer_7d_usd += f.saldo; else k.por_vencer_7d_mxn += f.saldo;
      }
    }
  }
  return k;
}

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

