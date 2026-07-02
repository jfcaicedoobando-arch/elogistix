/**
 * Funciones puras para agregar/clasificar filas de las bandejas operativas.
 * Sin Supabase, sin React. Permiten testear KPIs y filtros sin levantar UI.
 */
import type {
  CarteraPendienteRow,
  CxpPorCapturarRow,
  CxpPorPagarRow,
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
  vencidas: number;
  /** Saldo homologado a MXN (USD * TC, MXN tal cual). EUR sin TC queda fuera. */
  saldoMXN: number;
  /** Suma por moneda nativa (sin conversión). */
  porMoneda: { MXN: number; USD: number; EUR: number };
  /** Cantidad de facturas en moneda extranjera sin tipo de cambio capturado. */
  faltaTipoCambio: number;
}

export function resumirCxpPorPagar(rows: CxpPorPagarRow[]): CxpPagarSummary {
  let vencidas = 0;
  let saldoMXN = 0;
  let faltaTipoCambio = 0;
  const porMoneda = { MXN: 0, USD: 0, EUR: 0 };

  for (const r of rows) {
    const saldo = num(r.saldo);
    const moneda = (r.moneda ?? "MXN").toUpperCase();
    if ((r.dias_para_vencer ?? 0) < 0) vencidas += 1;

    if (moneda === "MXN") {
      porMoneda.MXN += saldo;
      saldoMXN += saldo;
    } else if (moneda === "USD") {
      porMoneda.USD += saldo;
      const tc = num(r.tipo_cambio_usd);
      if (tc > 0) saldoMXN += saldo * tc;
      else faltaTipoCambio += 1;
    } else if (moneda === "EUR") {
      porMoneda.EUR += saldo;
      faltaTipoCambio += 1; // EUR no tiene TC en proveedor_facturas todavía
    }
  }

  return { total: rows.length, vencidas, saldoMXN, porMoneda, faltaTipoCambio };
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

