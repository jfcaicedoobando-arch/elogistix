/**
 * Servicio del estado de cuenta bancario (v13.450.0).
 * Lee la RPC `estado_cuenta_bancario`, que calcula el saldo inicial del
 * periodo y el saldo corrido movimiento por movimiento en SQL.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  EstadoCuentaBancario,
  MovimientoEstadoCuenta,
} from "@/features/tesoreria/domain/estadoCuenta";

export type {
  EstadoCuentaBancario,
  MovimientoEstadoCuenta,
} from "@/features/tesoreria/domain/estadoCuenta";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function mapMovimiento(row: Record<string, unknown>): MovimientoEstadoCuenta {
  return {
    id: String(row.id),
    fecha: String(row.fecha),
    concepto: str(row.concepto),
    referencia: str(row.referencia),
    cargo: num(row.cargo),
    abono: num(row.abono),
    estado_conciliacion: String(row.estado_conciliacion ?? "Pendiente"),
    saldo_corrido: num(row.saldo_corrido),
    pago_factura_id: str(row.pago_factura_id),
    pago_proveedor_id: str(row.pago_proveedor_id),
    anticipo_proveedor_id: str(row.anticipo_proveedor_id),
    pago_proveedor_lote_id: str(row.pago_proveedor_lote_id),
  };
}

export async function fetchEstadoCuentaBancario(
  cuentaBancariaId: string,
  desde: string,
  hasta: string,
): Promise<EstadoCuentaBancario> {
  const { data, error } = await supabase.rpc("estado_cuenta_bancario", {
    p_cuenta_bancaria_id: cuentaBancariaId,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw error;
  // SAFE-CAST: jsonb con el shape declarado en la migración `estado_cuenta_bancario`.
  const raw = (data ?? {}) as unknown as Record<string, unknown>;
  const movs = Array.isArray(raw.movimientos) ? raw.movimientos : [];
  return {
    cuenta_id: String(raw.cuenta_id ?? cuentaBancariaId),
    alias: String(raw.alias ?? ""),
    banco: String(raw.banco ?? ""),
    moneda: String(raw.moneda ?? "MXN"),
    desde,
    hasta,
    saldo_inicial: num(raw.saldo_inicial),
    total_entradas: num(raw.total_entradas),
    total_salidas: num(raw.total_salidas),
    saldo_final: num(raw.saldo_final),
    movimientos: movs.map((m) => mapMovimiento(m as Record<string, unknown>)),
  };
}
