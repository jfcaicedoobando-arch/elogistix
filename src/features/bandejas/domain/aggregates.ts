/**
 * Funciones puras para agregar/clasificar filas de las bandejas operativas.
 * Sin Supabase, sin React. Permiten testear KPIs y filtros sin levantar UI.
 */
import type {
  CarteraPendienteRow,
  CxpPorCapturarRow,
  CxpPorPagarRow,
  FacturacionPorEmitirRow,
} from "../services/bandejas";

const num = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;

// ===== Cartera =====
export interface CarteraSummary {
  total: number;
  totalSaldo: number;
  vencidas: number;
  vencidoSaldo: number;
}

export function resumirCartera(rows: CarteraPendienteRow[]): CarteraSummary {
  let totalSaldo = 0;
  let vencidas = 0;
  let vencidoSaldo = 0;
  for (const r of rows) {
    const s = num(r.saldo);
    totalSaldo += s;
    if (r.dias_vencido > 0) {
      vencidas += 1;
      vencidoSaldo += s;
    }
  }
  return { total: rows.length, totalSaldo, vencidas, vencidoSaldo };
}

// ===== CxP por pagar =====
export interface CxpPagarSummary {
  total: number;
  totalSaldo: number;
  vencidas: number;
}

export function resumirCxpPorPagar(rows: CxpPorPagarRow[]): CxpPagarSummary {
  let totalSaldo = 0;
  let vencidas = 0;
  for (const r of rows) {
    totalSaldo += num(r.saldo);
    if ((r.dias_para_vencer ?? 0) < 0) vencidas += 1;
  }
  return { total: rows.length, totalSaldo, vencidas };
}

/** Variante visual del badge según días para vencer. */
export type DiasVariant = "destructive" | "secondary" | "outline";
export function variantDiasParaVencer(dias: number): DiasVariant {
  if (dias < 0) return "destructive";
  if (dias <= 7) return "secondary";
  return "outline";
}

// ===== CxP por capturar =====
export interface CxpCapturarSummary {
  total: number;
  totalPresupuestado: number;
  facturasCapturadas: number;
}

export function resumirCxpPorCapturar(rows: CxpPorCapturarRow[]): CxpCapturarSummary {
  let totalPresupuestado = 0;
  let facturasCapturadas = 0;
  for (const r of rows) {
    totalPresupuestado += num(r.costos_presupuestados);
    facturasCapturadas += r.facturas_capturadas ?? 0;
  }
  return { total: rows.length, totalPresupuestado, facturasCapturadas };
}

// ===== Facturación por emitir =====
export const DIAS_ATRASO_FACTURACION = 7;

export interface FacturacionEmitirSummary {
  total: number;
  totalPorFacturar: number;
  atrasadas: number;
}

export function resumirFacturacionPorEmitir(
  rows: FacturacionPorEmitirRow[],
): FacturacionEmitirSummary {
  let totalPorFacturar = 0;
  let atrasadas = 0;
  for (const r of rows) {
    totalPorFacturar += num(r.total);
    if (r.dias_desde_emision > DIAS_ATRASO_FACTURACION) atrasadas += 1;
  }
  return { total: rows.length, totalPorFacturar, atrasadas };
}
