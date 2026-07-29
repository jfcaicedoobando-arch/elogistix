/**
 * Tipos y utilidades puras del Estado de Cuenta por cliente.
 *
 * Se separan del servicio (`estadoCuenta.ts`) para respetar el límite de
 * tamaño de archivo (Power of 10) y poder testear las funciones puras
 * (`diasVencido`, `calcularEstatus`) sin tocar la capa de datos.
 */
import type { Tables, Database } from "@/integrations/supabase/types";

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

/** Shape del jsonb de `estado_cuenta_agregados` (C3c). */
export interface KpisEstadoCuentaRemotos {
  adeudado_mxn: number;
  adeudado_usd: number;
  vencido_mxn: number;
  vencido_usd: number;
  a_favor_mxn: number;
  a_favor_usd: number;
  facturas_vencidas: number;
  facturas_adeudadas: number;
}

export const KPIS_ESTADO_CUENTA_VACIOS: KpisEstadoCuentaRemotos = {
  adeudado_mxn: 0, adeudado_usd: 0,
  vencido_mxn: 0, vencido_usd: 0,
  a_favor_mxn: 0, a_favor_usd: 0,
  facturas_vencidas: 0, facturas_adeudadas: 0,
};

export type RawPago = {
  id: string;
  fecha_pago: string;
  monto: number;
  moneda: string;
  tipo_cambio: number | null;
  monto_aplicado_factura: number;
  forma_pago: string | null;
  referencia: string | null;
  deleted_at: string | null;
};

export type RawNota = {
  id: string;
  folio: string | null;
  fecha_emision: string;
  monto: number;
  estado: string;
  deleted_at: string | null;
};

export type RawFactura = Pick<
  FacturaRow,
  | "id" | "numero" | "cliente_id" | "cliente_nombre" | "expediente"
  | "moneda" | "total" | "fecha_emision" | "fecha_vencimiento" | "estado"
> & {
  pagos_factura: RawPago[] | null;
  factura_notas_credito: RawNota[] | null;
};

export function diasVencido(fechaVencimiento: string): number {
  const venc = new Date(fechaVencimiento + "T00:00:00");
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
}

export function calcularEstatus(
  saldo: number,
  dias: number,
  estado: FacturaRow["estado"],
): EstatusCobranza {
  if (estado === "Pagada") return "Pagada";
  if (saldo <= 0.01) return "Sin saldo";
  if (dias > 0) return "Vencida";
  // B-105 (decisión de diseño): "Por vencer" = vence en 7 días naturales o
  // menos, alineado con la convención del ERP (tarifas "≤7 días", aging CxC).
  // Antes eran 3 días: una factura a 17 días se veía "Vigente".
  if (dias >= -7) return "Por vencer";
  return "Vigente";
}

/** Mapea una fila cruda (con joins embebidos) al shape de UI. */
export function mapFacturaEstadoCuenta(f: RawFactura): FacturaEstadoCuenta {
  const pagosActivos = (f.pagos_factura ?? []).filter((p) => !p.deleted_at);
  const notasActivas = (f.factura_notas_credito ?? []).filter(
    (n) => !n.deleted_at && n.estado === "Aplicada",
  );
  const pagado = pagosActivos.reduce((s, p) => s + Number(p.monto_aplicado_factura), 0);
  const nc_aplicadas = notasActivas.reduce((s, n) => s + Number(n.monto), 0);
  const total = Number(f.total);
  const saldo = Math.max(0, total - pagado - nc_aplicadas);
  const dias = diasVencido(f.fecha_vencimiento);

  return {
    id: f.id,
    numero: f.numero,
    cliente_id: f.cliente_id,
    cliente_nombre: f.cliente_nombre,
    expediente: f.expediente,
    moneda: f.moneda,
    total,
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
      // B-077: `monto` está en moneda del PAGO y `monto_aplicado_factura`
      // en moneda de la FACTURA — restarlos directo inventa saldos a favor
      // (factura USD pagada en MXN mostraba "USD 175,000 a favor").
      // Convención (la misma de DialogRegistrarPago): `tipo_cambio`
      // convierte moneda del pago → moneda de la factura; el excedente
      // queda expresado en moneda de la factura. Sin TC confiable → 0.
      monto_no_aplicado: montoNoAplicado(p, f.moneda),
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

function montoNoAplicado(p: RawPago, monedaFactura: Moneda): number {
  const tc = Number(p.tipo_cambio);
  const factor = p.moneda === monedaFactura ? 1 : Number.isFinite(tc) && tc > 0 ? tc : 0;
  return Math.max(0, Number(p.monto) * factor - Number(p.monto_aplicado_factura));
}
