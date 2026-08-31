/**
 * Helpers puros para `proveedorFacturas` service.
 * Extraídos para mantener el service ≤200 líneas (Power of 10 #4).
 * Sin Supabase, sin React: testeables en aislamiento.
 */
import type { Tables } from "@/integrations/supabase/types";
import type { FacturaCxP, EstatusCxP, FetchCxPFiltros } from "./proveedorFacturas";
import { diasVencidos } from "@/lib/date/dateOnly";

type ProveedorFacturaRow = Tables<"proveedor_facturas">;
type EstadoProveedorFactura = ProveedorFacturaRow["estado"];

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

/**
 * C3: un pago puede estar en otra moneda que la factura (USD facturada, pagada
 * en MXN). El trigger de BD calcula `monto_en_moneda_factura`; sumar `monto`
 * crudo infla lo pagado ~17× y marca facturas como liquidadas antes de tiempo.
 */
export function sumarPagosEnMonedaFactura(pagos: PagoCxpParcial[] | null): number {
  return (pagos ?? [])
    .filter((p) => !p.deleted_at)
    .reduce((s, p) => s + Number(p.monto_en_moneda_factura ?? p.monto), 0);
}

/** Fila mínima de nota de crédito de proveedor usada para saldar. */
export type NotaCreditoCxpParcial = {
  monto: number;
  estado: string;
  deleted_at: string | null;
};

/**
 * A-2: canon de "NC que reducen el saldo" del lado cliente — sólo las
 * `Aplicada` y no eliminadas, igual que `public.saldo_factura_proveedor`.
 * Reusado por el listado de CxP y por la bandeja de pagos programados.
 */
export function sumarNotasCreditoAplicadas(ncs: NotaCreditoCxpParcial[] | null): number {
  return (ncs ?? [])
    .filter((n) => !n.deleted_at && n.estado === "Aplicada")
    .reduce((s, n) => s + Number(n.monto), 0);
}

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


export function diasVencido(fechaVenc: string | null): number {
  if (!fechaVenc) return 0;
  return diasVencidos(fechaVenc.slice(0, 10));
}

/**
 * Deriva el estatus primario aplicando la regla de prioridad de `EstatusCxP`.
 * Ver JSDoc en `proveedorFacturas.ts` para el orden completo.
 * Ventana "Por vencer" = 5 días (definida con producto v13.304.1).
 */
export function clasificar(
  saldo: number,
  pagado: number,
  dias: number,
  estado: EstadoProveedorFactura,
  aprobacion: "pendiente" | "aprobada" | "rechazada",
): EstatusCxP {
  if (estado === "Cancelada") return "Cancelada";
  if (aprobacion === "rechazada") return "Rechazada";
  if (estado === "Borrador") return "Borrador";
  if (aprobacion === "pendiente") return "Por aprobar";
  if (estado === "Pagada" || saldo <= 0.01) return "Pagada";
  if (dias > 0) return "Vencida";
  if (dias >= -5) return "Por vencer";
  if (pagado > 0.01) return "Parcial";
  return "Vigente";
}

/** Extraído para bajar complejidad ciclomática de mapJoinedRow (< 17). */
function mapCancelacion(f: Joined) {
  return {
    fecha_cancelacion: f.fecha_cancelacion ?? null,
    motivo_cancelacion: f.motivo_cancelacion ?? null,
    cancelada_por: f.cancelada_por ?? null,
    created_by: f.created_by ?? null,
  };
}

function mapVerificacionSat(f: Joined) {
  return {
    uuid_verificado: f.uuid_verificado ?? false,
    uuid_verificado_fecha: f.uuid_verificado_fecha,
    uuid_estatus_sat: f.uuid_estatus_sat,
  };
}

/** Deriva los `flags` UI (chips secundarios + tooltip) desde la fila cruda. */
function computeFlags(
  f: Joined, pagado: number, nc: number, saldo: number, total: number,
): FacturaCxP["flags"] {
  const cubierto = pagado + nc;
  const canceladaPor: "sat" | "manual" | null =
    f.estado === "Cancelada"
      ? (f.uuid_estatus_sat === "Cancelado" ? "sat" : "manual")
      : null;
  return {
    parcial: pagado > 0.01 && saldo > 0.01,
    parcialPct: total > 0 ? Math.min(100, Math.round((cubierto / total) * 100)) : 0,
    ncAplicada: nc > 0.01,
    satVerificada: Boolean(f.uuid_verificado),
    canceladaPor,
  };
}

export function mapJoinedRow(f: Joined): FacturaCxP {
  const pagado = sumarPagosEnMonedaFactura(f.pagos_proveedor);
  const nc = sumarNotasCreditoAplicadas(f.proveedor_notas_credito);
  const total = Number(f.total);
  const saldo = Math.max(0, total - pagado - nc);
  const yaSaldada = f.estado === "Pagada" || saldo <= 0.01;
  const dv = yaSaldada ? 0 : diasVencido(f.fecha_vencimiento);
  return {
    id: f.id,
    proveedor_id: f.proveedor_id,
    proveedor_nombre: f.proveedor_nombre,
    proveedor_origen: f.proveedores?.origen_proveedor ?? null,
    embarque_id: f.embarque_id,
    embarque_expediente: f.embarques?.expediente ?? null,
    folio_proveedor: f.folio_proveedor,
    folio_interno: f.folio_interno,
    fecha_emision: f.fecha_emision,
    fecha_vencimiento: f.fecha_vencimiento,
    dias_vencido: Math.max(0, dv),
    moneda: f.moneda,
    total,
    pagado,
    notas_credito: nc,
    saldo,
    estado: f.estado,
    estatus: clasificar(saldo, pagado, dv, f.estado, f.estado_aprobacion),
    tipo_cambio_usd: Number(f.tipo_cambio_usd),
    estado_aprobacion: f.estado_aprobacion,
    motivo_rechazo: f.motivo_rechazo,
    categoria_presupuesto_id: f.categoria_presupuesto_id,
    categoria_nombre: f.presupuesto_categorias?.nombre ?? null,
    subtotal: Number(f.subtotal ?? 0),
    iva: Number(f.iva ?? 0),
    ieps: Number(f.ieps ?? 0),
    retenciones: Number(f.retenciones ?? 0),
    rfc_proveedor: f.rfc_proveedor,
    uuid_fiscal: f.uuid_fiscal,
    dias_credito: f.dias_credito,
    notas: f.notas,
    archivo_xml_url: f.archivo_xml_url,
    archivo_pdf_url: f.archivo_pdf_url,
    ...mapVerificacionSat(f),
    fecha_programada_pago: f.fecha_programada_pago ?? null,
    ...mapCancelacion(f),
    flags: computeFlags(f, pagado, nc, saldo, total),
  };
}


export function aplicarFiltrosCliente(rows: FacturaCxP[], filtros: FetchCxPFiltros): FacturaCxP[] {
  let r = rows;
  if (filtros.estatus && filtros.estatus !== "todos") r = r.filter(x => x.estatus === filtros.estatus);
  if (filtros.origen && filtros.origen !== "todos") r = r.filter(x => x.proveedor_origen === filtros.origen);
  if (filtros.aprobacion && filtros.aprobacion !== "todos") r = r.filter(x => x.estado_aprobacion === filtros.aprobacion);
  return r;
}
