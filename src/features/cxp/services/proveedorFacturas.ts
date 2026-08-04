/**
 * Services CxP — Cuentas por Pagar a proveedores.
 *
 * Lista facturas de proveedor con saldo calculado (vía v_proveedor_facturas_saldo),
 * KPIs (por pagar / vencido / por vencer 7d) y CRUD básico.
 *
 * Lógica pura (clasificación, mapeo, filtros cliente) en `./proveedorFacturas.helpers`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { orIlike } from "@/lib/search/ilike";
import {
  PROVEEDOR_FACTURAS_SELECT,
  mapJoinedRow,
  aplicarFiltrosCliente,
  type Joined,
} from "./proveedorFacturas.helpers";

export type ProveedorFacturaRow = Tables<"proveedor_facturas">;
export type EstadoProveedorFactura = ProveedorFacturaRow["estado"];
/**
 * Estatus primario derivado (chip único de la tabla CxP).
 * Orden = prioridad. El primero que aplique gana.
 *   Cancelada       → estado = Cancelada
 *   Rechazada       → estado_aprobacion = rechazada  (excluida de aging)
 *   Borrador        → estado = Borrador
 *   Por aprobar     → estado_aprobacion = pendiente
 *   Pagada          → estado = Pagada o saldo ≤ 0.01
 *   Vencida         → dias_vencido > 0 con saldo > 0
 *   Por vencer      → dias_vencido entre -5 y 0 (ventana de tesorería 5 días)
 *   Parcial         → hay pagos aplicados pero aún queda saldo
 *   Vigente         → default
 * SAT (uuid_estatus_sat) NO participa aquí; se muestra como chip aparte
 * en el detalle de la factura.
 */
export type EstatusCxP =
  | "Cancelada"
  | "Rechazada"
  | "Borrador"
  | "Por aprobar"
  | "Pagada"
  | "Vencida"
  | "Por vencer"
  | "Parcial"
  | "Vigente";

export interface FacturaCxP {
  id: string;
  proveedor_id: string;
  proveedor_nombre: string;
  proveedor_origen: "Nacional" | "Extranjero" | null;
  embarque_id: string | null;
  embarque_expediente: string | null;
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
  ieps: number;
  retenciones: number;
  rfc_proveedor: string | null;
  uuid_fiscal: string | null;
  dias_credito: number | null;
  notas: string | null;
  archivo_xml_url: string | null;
  archivo_pdf_url: string | null;
  uuid_verificado: boolean;
  uuid_verificado_fecha: string | null;
  uuid_estatus_sat: string | null;
  fecha_programada_pago: string | null;
  fecha_cancelacion: string | null;
  motivo_cancelacion: string | null;
  cancelada_por: string | null;
  /**
   * Flags derivados de la factura que enriquecen el chip de estado sin
   * competir con el estatus primario (`estatus`).  Consumidos por
   * `EstadoFacturaCxPCell` para pintar chips secundarios (Parcial, +N d
   * vencida, NC, SAT ✓, Prog. DD/MM) y por el tooltip informativo.
   */
  flags: {
    parcial: boolean;
    /** Porcentaje pagado 0..100, redondeado. */
    parcialPct: number;
    ncAplicada: boolean;
    satVerificada: boolean;
    /** Cancelada por rechazo del SAT vs cancelación manual. null si no aplica. */
    canceladaPor: "sat" | "manual" | null;
  };
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
  /** α.1 — Paginación server-side. Default page=1, pageSize=200. Cap defensivo pageSize<=1000. */
  page?: number;
  pageSize?: number;
}

/** α.1 — Default y cap defensivo para la paginación. */
const CXP_PAGE_SIZE_DEFAULT = 200;
const CXP_PAGE_SIZE_MAX = 1000;

export async function fetchFacturasCxP(filtros: FetchCxPFiltros = {}): Promise<FacturaCxP[]> {
  // α.1 — Antes había .limit(2000) hardcoded → con 30 facturas/día se llenaba
  // en ~67 días y las nuevas dejaban de aparecer. Ahora paginado con .range().
  const page = Math.max(1, Math.floor(Number(filtros.page ?? 1)));
  const pageSize = Math.min(
    CXP_PAGE_SIZE_MAX,
    Math.max(1, Math.floor(Number(filtros.pageSize ?? CXP_PAGE_SIZE_DEFAULT))),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("proveedor_facturas")
    .select(PROVEEDOR_FACTURAS_SELECT)
    .is("deleted_at", null)
    .neq("estado", "Cancelada")
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
    .range(from, to);

  if (filtros.proveedor_id && filtros.proveedor_id !== "todos") q = q.eq("proveedor_id", filtros.proveedor_id);
  if (filtros.categoria_presupuesto_id && filtros.categoria_presupuesto_id !== "todas") {
    q = q.eq("categoria_presupuesto_id", filtros.categoria_presupuesto_id);
  }
  if (filtros.moneda && filtros.moneda !== "todas") q = q.eq("moneda", filtros.moneda);
  if (filtros.fecha_desde) q = q.gte("fecha_emision", filtros.fecha_desde);
  if (filtros.fecha_hasta) q = q.lte("fecha_emision", filtros.fecha_hasta);
  if (filtros.search) {
    q = q.or(orIlike(["folio_interno", "folio_proveedor", "proveedor_nombre"], filtros.search));
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
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // SAFE-CAST: mismo shape `Joined` validado por el select de arriba.
  return mapJoinedRow(data as unknown as Joined);
}

export { calcularKPIsCxP, type KPIsCxP } from "./cxpKpis";

export {
  crearFacturaProveedor,
  existeFacturaDuplicada,
  buscarFacturaDuplicadaFolio,

  buscarFacturaPorUuidFiscal,
  buscarFacturaPorUuidFiscalResultado,
  type BusquedaUuidFiscal,
  type FacturaExistentePorUuid,

  softDeleteFacturaProveedor,
  type NuevaFacturaProveedorPayload,
} from "./proveedorFacturas.crud";


