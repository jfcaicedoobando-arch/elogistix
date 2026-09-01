/**
 * Funciones puras para agregar/clasificar filas de las bandejas operativas.
 * Sin Supabase, sin React. Permiten testear KPIs y filtros sin levantar UI.
 */
import type {
  CarteraPendienteRow,
  CxpPorCapturarRow,
  CxpPorPagarRow,
} from "../services/bandejas";
import {
  esAccionable,
  estaPorVencer,
  esVencidoPorDias,
  esVencidoPorDiasParaVencer,
} from "@/lib/domain/vencimiento";
import { aMxn } from "@/lib/financial/convertir";


const num = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;

// ===== Cartera =====
/**
 * Saldos separados por moneda nativa (sin conversión FX). Los buckets MXN/USD
 * son canónicos; cualquier otra moneda se acumula en `otras` para no
 * contaminar los totales oficiales.
 */
export interface SaldosPorMonedaCartera {
  MXN: number;
  USD: number;
  otras: Record<string, number>;
}

export interface CarteraSummary {
  total: number;
  saldosNativos: SaldosPorMonedaCartera;
  vencidasCount: number;
  vencidoNativo: SaldosPorMonedaCartera;
  /** @deprecated usar `saldosNativos` — suma cruda MXN+USD (compat). */
  totalSaldo: number;
  /** @deprecated usar `vencidasCount`. */
  vencidas: number;
  /** @deprecated usar `vencidoNativo` — suma cruda MXN+USD (compat). */
  vencidoSaldo: number;
}

function bucketVacio(): SaldosPorMonedaCartera {
  return { MXN: 0, USD: 0, otras: {} };
}

function acumular(bucket: SaldosPorMonedaCartera, moneda: string, s: number): void {
  const m = (moneda || "MXN").toUpperCase();
  if (m === "MXN") bucket.MXN += s;
  else if (m === "USD") bucket.USD += s;
  else bucket.otras[m] = (bucket.otras[m] ?? 0) + s;
}

export function resumirCartera(rows: CarteraPendienteRow[]): CarteraSummary {
  const saldosNativos = bucketVacio();
  const vencidoNativo = bucketVacio();
  let totalSaldo = 0;
  let vencidasCount = 0;
  let vencidoSaldo = 0;

  for (const r of rows) {
    const s = num(r.saldo);
    const moneda = (r as { moneda?: string }).moneda ?? "MXN";
    acumular(saldosNativos, moneda, s);
    totalSaldo += s;
    if (esVencidoPorDias(r.dias_vencido)) {
      vencidasCount += 1;
      vencidoSaldo += s;
      acumular(vencidoNativo, moneda, s);
    }
  }

  return {
    total: rows.length,
    saldosNativos,
    vencidasCount,
    vencidoNativo,
    totalSaldo,
    vencidas: vencidasCount,
    vencidoSaldo,
  };
}

/**
 * Filtro de urgencia para el módulo de Cartera / cobranza. Los umbrales viven
 * en el canon `@/lib/domain/vencimiento` (`DIAS_POR_VENCER_CXC`), no aquí.
 * - `accionable` (default UI): vencidas + por vencer en la ventana oficial.
 * - `vencidas`: sólo las ya vencidas.
 * - `por_vencer`: aún no vence, pero está dentro de la ventana.
 * - `todas`: sin filtro.
 *
 * `dias_vencido` viene del RPC como (hoy − vencimiento): positivo = ya venció,
 * cero = vence hoy, negativo = aún le quedan días.
 */
export type UrgenciaCartera = "accionable" | "vencidas" | "por_vencer" | "todas";

export function matchesUrgencia(diasVencido: number, urgencia: UrgenciaCartera): boolean {
  switch (urgencia) {
    case "vencidas": return esVencidoPorDias(diasVencido);
    case "por_vencer": return estaPorVencer(diasVencido);
    case "accionable": return esAccionable(diasVencido);
    case "todas": return true;
  }
}

// ===== CxP por pagar =====
export interface CxpPagarSummary {
  total: number;
  vencidas: number;
  /** Saldo homologado a MXN vía el canon `aMxn`. Sin TC confiable no se suma. */
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
    // `dias_para_vencer` invierte el signo respecto a CxC: el canon lo normaliza.
    if (esVencidoPorDiasParaVencer(r.dias_para_vencer)) vencidas += 1;

    if (moneda === "MXN" || moneda === "USD" || moneda === "EUR") {
      porMoneda[moneda] += saldo;
    }
    // EUR no tiene TC en `proveedor_facturas` todavía: `aMxn` lo marca incompleto.
    const conv = aMxn(saldo, moneda, moneda === "USD" ? num(r.tipo_cambio_usd) : null);
    if (conv.completo) saldoMXN += conv.monto;
    else faltaTipoCambio += 1;
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
  totalPresupuestadoMxn: number;
  totalPresupuestadoUsd: number;
  facturasCapturadas: number;
}

export function resumirCxpPorCapturar(rows: CxpPorCapturarRow[]): CxpCapturarSummary {
  let totalPresupuestadoMxn = 0;
  let totalPresupuestadoUsd = 0;
  let facturasCapturadas = 0;
  for (const r of rows) {
    totalPresupuestadoMxn += num(r.presupuestado_mxn);
    totalPresupuestadoUsd += num(r.presupuestado_usd);
    facturasCapturadas += r.facturas_capturadas ?? 0;
  }
  return { total: rows.length, totalPresupuestadoMxn, totalPresupuestadoUsd, facturasCapturadas };
}

