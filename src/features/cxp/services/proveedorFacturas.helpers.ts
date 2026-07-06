/**
 * Helpers puros para `proveedorFacturas` service.
 * Extraídos para mantener el service ≤200 líneas (Power of 10 #4).
 * Sin Supabase, sin React: testeables en aislamiento.
 */
import type { Tables } from "@/integrations/supabase/types";
import type { FacturaCxP, EstatusCxP, FetchCxPFiltros } from "./proveedorFacturas";

type ProveedorFacturaRow = Tables<"proveedor_facturas">;
type EstadoProveedorFactura = ProveedorFacturaRow["estado"];

/** Select reutilizado por list + single fetch (evita duplicar el embed). */
export const PROVEEDOR_FACTURAS_SELECT = `
  id, proveedor_id, proveedor_nombre, embarque_id, folio_proveedor, folio_interno,
  fecha_emision, fecha_vencimiento, moneda, subtotal, iva, retenciones, total,
  estado, tipo_cambio_usd, rfc_proveedor, uuid_fiscal, dias_credito, notas,
  estado_aprobacion, motivo_rechazo, categoria_presupuesto_id,
  archivo_xml_url, archivo_pdf_url,
  uuid_verificado, uuid_verificado_fecha, uuid_estatus_sat,
  fecha_programada_pago,
  fecha_cancelacion, motivo_cancelacion, cancelada_por,
  pagos_proveedor(monto, deleted_at),
  proveedor_notas_credito(monto, estado, deleted_at),
  proveedores(origen_proveedor),
  presupuesto_categorias!categoria_presupuesto_id(nombre)
` as const;

export type Joined = Pick<
  ProveedorFacturaRow,
  | "id" | "proveedor_id" | "proveedor_nombre" | "embarque_id" | "folio_proveedor" | "folio_interno"
  | "fecha_emision" | "fecha_vencimiento" | "moneda" | "subtotal" | "iva" | "retenciones" | "total"
  | "estado" | "tipo_cambio_usd" | "rfc_proveedor" | "uuid_fiscal" | "dias_credito" | "notas"
  | "estado_aprobacion" | "motivo_rechazo" | "categoria_presupuesto_id"
  | "archivo_xml_url" | "archivo_pdf_url"
  | "uuid_verificado" | "uuid_verificado_fecha" | "uuid_estatus_sat"
  | "fecha_programada_pago"
  | "fecha_cancelacion" | "motivo_cancelacion" | "cancelada_por"
> & {
  pagos_proveedor: Array<{ monto: number; deleted_at: string | null }> | null;
  proveedor_notas_credito: Array<{ monto: number; estado: string; deleted_at: string | null }> | null;
  proveedores: { origen_proveedor: "Nacional" | "Extranjero" | null } | null;
  presupuesto_categorias: { nombre: string } | null;
};


export function diasVencido(fechaVenc: string | null): number {
  if (!fechaVenc) return 0;
  const venc = new Date(fechaVenc + "T00:00:00");
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy.getTime() - venc.getTime()) / 86_400_000);
}

export function clasificar(saldo: number, dias: number, estado: EstadoProveedorFactura): EstatusCxP {
  if (estado === "Pagada") return "Pagada";
  if (saldo <= 0.01) return "Sin saldo";
  if (dias > 0) return "Vencida";
  if (dias >= -3) return "Por vencer";
  return "Vigente";
}

export function mapJoinedRow(f: Joined): FacturaCxP {
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
    estatus: clasificar(saldo, dv, f.estado),
    tipo_cambio_usd: Number(f.tipo_cambio_usd),
    estado_aprobacion: f.estado_aprobacion,
    motivo_rechazo: f.motivo_rechazo,
    categoria_presupuesto_id: f.categoria_presupuesto_id,
    categoria_nombre: f.presupuesto_categorias?.nombre ?? null,
    subtotal: Number(f.subtotal ?? 0),
    iva: Number(f.iva ?? 0),
    retenciones: Number(f.retenciones ?? 0),
    rfc_proveedor: f.rfc_proveedor,
    uuid_fiscal: f.uuid_fiscal,
    dias_credito: f.dias_credito,
    notas: f.notas,
    archivo_xml_url: f.archivo_xml_url,
    archivo_pdf_url: f.archivo_pdf_url,
    uuid_verificado: f.uuid_verificado ?? false,
    uuid_verificado_fecha: f.uuid_verificado_fecha,
    uuid_estatus_sat: f.uuid_estatus_sat,
    fecha_programada_pago: f.fecha_programada_pago ?? null,
  };
}


export function aplicarFiltrosCliente(rows: FacturaCxP[], filtros: FetchCxPFiltros): FacturaCxP[] {
  let r = rows;
  if (filtros.estatus && filtros.estatus !== "todos") r = r.filter(x => x.estatus === filtros.estatus);
  if (filtros.origen && filtros.origen !== "todos") r = r.filter(x => x.proveedor_origen === filtros.origen);
  if (filtros.aprobacion && filtros.aprobacion !== "todos") r = r.filter(x => x.estado_aprobacion === filtros.aprobacion);
  return r;
}
