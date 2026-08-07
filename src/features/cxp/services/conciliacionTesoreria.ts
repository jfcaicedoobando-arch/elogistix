/**
 * Conciliación automática de tesorería (v13.396.0).
 *
 * Vuelve a calcular, a partir de los pagos y sus movimientos bancarios ya
 * registrados, el saldo pendiente del proveedor y el estatus de cada factura,
 * y reporta las incidencias (pagos sin movimiento o con importe distinto).
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface FacturaConciliada {
  facturaId: string;
  folio: string;
  moneda: string;
  total: number;
  pagado: number;
  notasCredito: number;
  saldo: number;
  estado: string;
  pagos: number;
  movimientos: number;
}

export type TipoIncidencia = "sin_movimiento" | "descuadre";

export interface IncidenciaConciliacion {
  pagoId: string;
  facturaId: string;
  folio: string;
  fechaPago: string;
  monto: number;
  moneda: string;
  montoEsperadoMxn: number;
  cargoMxn: number;
  tipo: TipoIncidencia;
}

export interface SaldoProveedorConciliado {
  proveedorId: string;
  moneda: string;
  saldoPendiente: number;
  facturasAbiertas: number;
}

export interface ReporteConciliacion {
  facturasRevisadas: number;
  facturasActualizadas: number;
  facturas: FacturaConciliada[];
  incidencias: IncidenciaConciliacion[];
  proveedores: SaldoProveedorConciliado[];
  conciliadoAt: string;
}

type Raw = Record<string, unknown>;

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => String(v ?? "");

function lista(raw: Raw, campo: string): Raw[] {
  const v = raw[campo];
  // SAFE-CAST: la RPC devuelve jsonb tipado como `Json`; validamos que sea arreglo.
  return Array.isArray(v) ? (v as Raw[]) : [];
}

function mapFactura(f: Raw): FacturaConciliada {
  return {
    facturaId: str(f.factura_id),
    folio: str(f.folio) || "s/folio",
    moneda: str(f.moneda),
    total: num(f.total),
    pagado: num(f.pagado),
    notasCredito: num(f.notas_credito),
    saldo: num(f.saldo),
    estado: str(f.estado),
    pagos: num(f.pagos),
    movimientos: num(f.movimientos),
  };
}

function mapIncidencia(i: Raw): IncidenciaConciliacion {
  return {
    pagoId: str(i.pago_id),
    facturaId: str(i.factura_id),
    folio: str(i.folio) || "s/folio",
    fechaPago: str(i.fecha_pago),
    monto: num(i.monto),
    moneda: str(i.moneda),
    montoEsperadoMxn: num(i.monto_esperado_mxn),
    cargoMxn: num(i.cargo_mxn),
    tipo: i.tipo === "descuadre" ? "descuadre" : "sin_movimiento",
  };
}

export function mapReporteConciliacion(data: unknown): ReporteConciliacion {
  // SAFE-CAST: jsonb de la RPC `conciliar_tesoreria_proveedor`.
  const raw = (data ?? {}) as Raw;
  return {
    facturasRevisadas: num(raw.facturas_revisadas),
    facturasActualizadas: num(raw.facturas_actualizadas),
    facturas: lista(raw, "facturas").map(mapFactura),
    incidencias: lista(raw, "incidencias").map(mapIncidencia),
    proveedores: lista(raw, "proveedores").map((p) => ({
      proveedorId: str(p.proveedor_id),
      moneda: str(p.moneda),
      saldoPendiente: num(p.saldo_pendiente),
      facturasAbiertas: num(p.facturas_abiertas),
    })),
    conciliadoAt: str(raw.conciliado_at),
  };
}

export interface ConciliarTesoreriaInput {
  /** Conciliar todas las facturas del proveedor. */
  proveedorId?: string | null;
  /** Conciliar sólo esta factura. */
  facturaId?: string | null;
}

export async function conciliarTesoreriaProveedor(
  input: ConciliarTesoreriaInput,
): Promise<ReporteConciliacion> {
  const { data, error } = await supabase.rpc("conciliar_tesoreria_proveedor", {
    p_proveedor_id: input.proveedorId ?? undefined,
    p_factura_id: input.facturaId ?? undefined,
  });
  if (error) throw error;
  const reporte = mapReporteConciliacion(data);
  await registrarActividad({
    modulo: "tesoreria",
    accion: "conciliar_tesoreria_proveedor",
    entidadId: input.proveedorId ?? input.facturaId ?? null,
    detalles: {
      facturasRevisadas: reporte.facturasRevisadas,
      facturasActualizadas: reporte.facturasActualizadas,
      incidencias: reporte.incidencias.length,
    },
  });
  return reporte;
}
