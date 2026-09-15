/**
 * KPIs derivados del listado de Cuentas por Pagar.
 * Extraído de `proveedorFacturas.ts` para respetar el límite Power of 10 (≤200 líneas).
 */
import type { FacturaCxP } from "./proveedorFacturas";
import { esFacturaPorPagar } from "./cxpPorPagarFiltro";
import { diasVencidos } from "@/lib/date/dateOnly";
import { esVencidoPorDias, estaPorVencer } from "@/lib/domain/vencimiento";


export interface KPIsCxP {
  por_pagar_mxn: number;
  por_pagar_usd: number;
  /** MNY-NEW-07: cubeta EUR propia; antes el euro se sumaba dentro de `_mxn`. */
  por_pagar_eur: number;
  vencido_mxn: number;
  vencido_usd: number;
  vencido_eur: number;
  por_vencer_7d_mxn: number;
  por_vencer_7d_usd: number;
  por_vencer_7d_eur: number;
  facturas_vencidas: number;
}

type Cubeta = "mxn" | "usd" | "eur";

/**
 * MNY-NEW-07 — cubeta explícita por moneda. Cualquier divisa distinta de
 * USD/EUR sí cae en MXN (el enum `moneda` de la base sólo tiene esas tres),
 * pero el euro nunca se presenta como pesos.
 */
function cubetaDe(moneda: string | null | undefined): Cubeta {
  const m = (moneda ?? "MXN").toUpperCase();
  if (m === "USD") return "usd";
  if (m === "EUR") return "eur";
  return "mxn";
}

function diasVencido(fechaVenc: string | null): number {
  if (!fechaVenc) return 0;
  return diasVencidos(fechaVenc.slice(0, 10));
}

export function calcularKPIsCxP(filas: FacturaCxP[]): KPIsCxP {
  const k: KPIsCxP = {
    por_pagar_mxn: 0, por_pagar_usd: 0, por_pagar_eur: 0,
    vencido_mxn: 0, vencido_usd: 0, vencido_eur: 0,
    por_vencer_7d_mxn: 0, por_vencer_7d_usd: 0, por_vencer_7d_eur: 0,
    facturas_vencidas: 0,
  };
  for (const f of filas) {
    // Rechazadas/Canceladas se excluyen de aging/tesorería: no son deuda real
    // hasta que sean reaprobadas. Criterio compartido con el widget "Top 10
    // próximas a pagar" (Q-15.6): ver `esFacturaPorPagar`.
    if (!esFacturaPorPagar(f)) continue;
    const cubeta = cubetaDe(f.moneda);
    k[`por_pagar_${cubeta}`] += f.saldo;
    // B-020 (v13.320.39): KPI Vencido considera días vencidos reales,
    // no el estatus derivado (una factura "Por aprobar" vencida sigue siendo deuda).
    if (esVencidoPorDias(f.dias_vencido)) {
      k.facturas_vencidas++;
      k[`vencido_${cubeta}`] += f.saldo;
    }
    // Ventana "Por vencer" = canon único `DIAS_POR_VENCER_CXC` (7 días). Antes
    // CxP usaba 5 días mientras la tarjeta rotulaba "7 d" y CxC sí sumaba 7.
    if ((f.dias_vencido ?? 0) === 0 && f.fecha_vencimiento) {
      if (estaPorVencer(diasVencido(f.fecha_vencimiento))) {
        k[`por_vencer_7d_${cubeta}`] += f.saldo;
      }
    }
  }

  return k;
}
