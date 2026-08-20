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
  vencido_mxn: number;
  vencido_usd: number;
  por_vencer_7d_mxn: number;
  por_vencer_7d_usd: number;
  facturas_vencidas: number;
}

function diasVencido(fechaVenc: string | null): number {
  if (!fechaVenc) return 0;
  return diasVencidos(fechaVenc.slice(0, 10));
}

export function calcularKPIsCxP(filas: FacturaCxP[]): KPIsCxP {
  const k: KPIsCxP = {
    por_pagar_mxn: 0, por_pagar_usd: 0,
    vencido_mxn: 0, vencido_usd: 0,
    por_vencer_7d_mxn: 0, por_vencer_7d_usd: 0,
    facturas_vencidas: 0,
  };
  for (const f of filas) {
    // Rechazadas/Canceladas se excluyen de aging/tesorería: no son deuda real
    // hasta que sean reaprobadas. Criterio compartido con el widget "Top 10
    // próximas a pagar" (Q-15.6): ver `esFacturaPorPagar`.
    if (!esFacturaPorPagar(f)) continue;
    const usd = f.moneda === "USD";
    if (usd) k.por_pagar_usd += f.saldo; else k.por_pagar_mxn += f.saldo;
    // B-020 (v13.320.39): KPI Vencido considera días vencidos reales,
    // no el estatus derivado (una factura "Por aprobar" vencida sigue siendo deuda).
    if (esVencidoPorDias(f.dias_vencido)) {
      k.facturas_vencidas++;
      if (usd) k.vencido_usd += f.saldo; else k.vencido_mxn += f.saldo;
    }
    // Ventana "Por vencer" = canon único `DIAS_POR_VENCER_CXC` (7 días). Antes
    // CxP usaba 5 días mientras la tarjeta rotulaba "7 d" y CxC sí sumaba 7.
    if ((f.dias_vencido ?? 0) === 0 && f.fecha_vencimiento) {
      if (estaPorVencer(diasVencido(f.fecha_vencimiento))) {
        if (usd) k.por_vencer_7d_usd += f.saldo; else k.por_vencer_7d_mxn += f.saldo;
      }
    }
  }

  return k;
}
