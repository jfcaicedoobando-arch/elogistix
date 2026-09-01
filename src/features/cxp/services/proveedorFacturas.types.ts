/**
 * Tipos y filtros del módulo CxP (Cuentas por Pagar a proveedores).
 *
 * v13.504.1 — Extraídos de `proveedorFacturas.ts` para respetar el límite de
 * 200 líneas por archivo (Power of 10). El servicio los re-exporta, así que
 * los consumidores no cambian.
 */
import type { Tables } from "@/integrations/supabase/types";

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
  /** Quién capturó la factura (segregación de funciones al aprobar). */
  created_by: string | null;
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
}

/** Select reutilizado por list + single fetch (evita duplicar el embed). */
export const PROVEEDOR_FACTURAS_SELECT = `
  id, proveedor_id, proveedor_nombre, embarque_id, folio_proveedor, folio_interno,
  fecha_emision, fecha_vencimiento, moneda, subtotal, iva, ieps, retenciones, total,
  estado, tipo_cambio_usd, rfc_proveedor, uuid_fiscal, dias_credito, notas,
  estado_aprobacion, motivo_rechazo, categoria_presupuesto_id,
  archivo_xml_url, archivo_pdf_url,
  uuid_verificado, uuid_verificado_fecha, uuid_estatus_sat,
  fecha_programada_pago,
  fecha_cancelacion, motivo_cancelacion, cancelada_por, created_by,
  pagos_proveedor(monto, monto_en_moneda_factura, deleted_at),
  proveedor_notas_credito(monto, estado, deleted_at),
  proveedores(origen_proveedor),
  embarques(expediente),
  presupuesto_categorias!categoria_presupuesto_id(nombre)
` as const;

/** Fila mínima de pago usada para saldar una factura de proveedor. */
export type PagoCxpParcial = {
  monto: number;
  monto_en_moneda_factura: number | null;
  deleted_at: string | null;
};
/** Fila mínima de nota de crédito de proveedor usada para saldar. */
export type NotaCreditoCxpParcial = {
  monto: number;
  estado: string;
  deleted_at: string | null;
};
export type Joined = Pick<
  ProveedorFacturaRow,
  | "id" | "proveedor_id" | "proveedor_nombre" | "embarque_id" | "folio_proveedor" | "folio_interno"
  | "fecha_emision" | "fecha_vencimiento" | "moneda" | "subtotal" | "iva" | "ieps" | "retenciones" | "total"
  | "estado" | "tipo_cambio_usd" | "rfc_proveedor" | "uuid_fiscal" | "dias_credito" | "notas"
  | "estado_aprobacion" | "motivo_rechazo" | "categoria_presupuesto_id"
  | "archivo_xml_url" | "archivo_pdf_url"
  | "uuid_verificado" | "uuid_verificado_fecha" | "uuid_estatus_sat"
  | "fecha_programada_pago"
  | "fecha_cancelacion" | "motivo_cancelacion" | "cancelada_por" | "created_by"
> & {
  pagos_proveedor: Array<PagoCxpParcial> | null;
  proveedor_notas_credito: Array<NotaCreditoCxpParcial> | null;
  proveedores: { origen_proveedor: "Nacional" | "Extranjero" | null } | null;
  embarques: { expediente: string } | null;
  presupuesto_categorias: { nombre: string } | null;
};
