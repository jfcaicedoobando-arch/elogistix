/**
 * Tipos y utilidades puras del Estado de Cuenta por cliente.
 * Contratos y mapeo puro, sin acceso a la base de datos.
 */
import type { Tables, Database } from "@/integrations/supabase/types";
import { calcularSaldoFactura, esPagoAnulado } from "@/lib/financial/saldoFactura";
import { diasVencidos } from "@/lib/date/dateOnly";
import { estaPorVencer } from "@/features/facturacion/domain/porVencer";
import { notasCreditoMonedaFactura } from "@/lib/financial/notasCreditoMonedaFactura";
import { montoCobroEnMonedaFactura } from "@/lib/financial/montoCobroEnMonedaFactura";
import { esNcClienteVigente } from "@/lib/domain/estadosFactura";

export type FacturaRow = Tables<"facturas">;
export type Moneda = Database["public"]["Enums"]["moneda"];

export type EstatusCobranza = "Vigente" | "Por vencer" | "Vencida" | "Pagada" | "Sin saldo";

export interface PagoDetalle {
  id: string;
  fecha_pago: string;
  monto_aplicado: number;
  monto_no_aplicado: number;
  forma_pago: string | null;
  referencia: string | null;
}

export interface NotaCreditoDetalle {
  id: string;
  folio: string | null;
  fecha_emision: string;
  monto: number;
  estado: string;
}

export interface FacturaEstadoCuenta {
  id: string;
  numero: string;
  cliente_id: string;
  cliente_nombre: string;
  expediente: string;
  moneda: Moneda;
  total: number;
  /** TC histórico de la factura; ausente en snapshots anteriores. */
  tipo_cambio?: number | null;
  pagado: number;
  notas_credito_aplicadas: number;
  saldo: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  dias_vencido: number;
  estatus_cobranza: EstatusCobranza;
  estado_factura: FacturaRow["estado"];
  pagos: PagoDetalle[];
  notas_credito: NotaCreditoDetalle[];
}

export interface EstadoCuentaFilters {
  clienteIds: string[];
  desde?: string | null;
  hasta?: string | null;
  moneda?: Moneda | "todas";
  soloConSaldo?: boolean;
}

export { KPIS_ESTADO_CUENTA_VACIOS } from "./estadoCuentaKpisTypes";
export type { KpisEstadoCuentaRemotos } from "./estadoCuentaKpisTypes";

export type RawPago = {
  id: string;
  fecha_pago: string;
  monto: number;
  moneda: string;
  tipo_cambio: number | null;
  monto_aplicado_factura: number;
  forma_pago: string | null;
  referencia: string | null;
  /** v13.823.295 — un pago con REP 'Cancelado' está anulado y no suma. */
  estado_rep?: string | null;
  deleted_at: string | null;
};

export type RawNota = {
  id: string;
  folio: string | null;
  fecha_emision: string;
  monto: number;
  moneda: string;
  tipo_cambio: number | null;
  estado: string;
  deleted_at: string | null;
};

export type RawFactura = Pick<
  FacturaRow,
  | "id" | "numero" | "cliente_id" | "cliente_nombre" | "expediente"
  | "moneda" | "total" | "fecha_emision" | "fecha_vencimiento" | "estado"
> & {
  tipo_cambio?: number | null;
  pagos_factura: RawPago[] | null;
  factura_notas_credito: RawNota[] | null;
};

export function diasVencido(fechaVencimiento: string): number {
  return diasVencidos(fechaVencimiento);
}

export function calcularEstatus(
  saldo: number,
  dias: number,
  estado: FacturaRow["estado"],
): EstatusCobranza {
  if (estado === "Pagada" && saldo <= 0.01) return "Pagada";
  if (saldo <= 0.01) return "Sin saldo";
  if (dias > 0) return "Vencida";
  // B-105 (decisión de diseño): "Por vencer" = vence en 7 días naturales o
  // menos, alineado con la convención del ERP (tarifas "≤7 días", aging CxC).
  // Antes eran 3 días: una factura a 17 días se veía "Vigente".
  if (estaPorVencer(dias)) return "Por vencer";
  return "Vigente";
}

/** Mapea una fila cruda (con joins embebidos) al shape de UI. */
export function mapFacturaEstadoCuenta(f: RawFactura): FacturaEstadoCuenta {
  // Los REP cancelados no suman a cobrado ni reducen el saldo.
  const pagosActivos = (f.pagos_factura ?? []).filter(
    (p) => !p.deleted_at && !esPagoAnulado(p),
  );
  const { notas: notasActivas, total: credito } = notasCreditoMonedaFactura(
    (f.factura_notas_credito ?? []).filter((n) => !n.deleted_at && esNcClienteVigente(n.estado)),
    f.moneda, f.tipo_cambio,
  );
  const total = Number(f.total ?? 0);
  // A1: canon único `@/lib/financial/saldoFactura` (no reimplementar).
  const { saldo, pagado, notasCredito: nc_aplicadas } = calcularSaldoFactura(
    total,
    pagosActivos,
    [{ monto: credito }],
    f.estado,
  );

  const dias = diasVencido(f.fecha_vencimiento);
  return {
    id: f.id,
    numero: f.numero,
    cliente_id: f.cliente_id,
    cliente_nombre: f.cliente_nombre,
    expediente: f.expediente,
    moneda: f.moneda,
    total,
    tipo_cambio: f.tipo_cambio,
    pagado,
    notas_credito_aplicadas: nc_aplicadas,
    saldo,
    fecha_emision: f.fecha_emision,
    fecha_vencimiento: f.fecha_vencimiento,
    dias_vencido: Math.max(0, dias),
    estatus_cobranza: calcularEstatus(saldo, dias, f.estado),
    estado_factura: f.estado,
    pagos: pagosActivos.map((p) => ({
      id: p.id,
      fecha_pago: p.fecha_pago,
      monto_aplicado: Number(p.monto_aplicado_factura),
      // AUD109: el TC está en pesos por divisa. El excedente conserva la
      // moneda de factura y la conversión histórica canónica, sin inventar TC.
      monto_no_aplicado: montoNoAplicado(p, f.moneda, f.tipo_cambio),
      forma_pago: p.forma_pago,
      referencia: p.referencia,
    })),
    notas_credito: notasActivas.map((n) => ({
      id: n.id,
      folio: n.folio,
      fecha_emision: n.fecha_emision,
      monto: Number(n.monto),
      estado: n.estado,
    })),
  };
}
function montoNoAplicado(p: RawPago, monedaFactura: Moneda, tcFactura: number | null | undefined): number {
  const recibido = montoCobroEnMonedaFactura(Number(p.monto), p.moneda, p.tipo_cambio, monedaFactura, tcFactura);
  const aplicado = Number(p.monto_aplicado_factura);
  if (recibido === null || !Number.isFinite(aplicado) || aplicado < 0) return 0;
  return Math.max(0, recibido - aplicado);
}
