/**
 * KPIs derivados del listado de Cuentas por Pagar.
 * Extraído de `proveedorFacturas.ts` para respetar el límite Power of 10 (≤200 líneas).
 */
import type { FacturaCxP } from "./proveedorFacturas";
import { esFacturaPorPagar } from "./cxpPorPagarFiltro";

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
  const venc = new Date(fechaVenc + "T00:00:00");
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy.getTime() - venc.getTime()) / 86_400_000);
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
    if ((f.dias_vencido ?? 0) > 0) {
      k.facturas_vencidas++;
      if (usd) k.vencido_usd += f.saldo; else k.vencido_mxn += f.saldo;
    }
    // Ventana "Por vencer" ampliada a 5 días (política v13.304.1).
    if (f.dias_vencido === 0 && f.fecha_vencimiento) {
      const dv = diasVencido(f.fecha_vencimiento);
      if (dv >= -5 && dv <= 0) {
        if (usd) k.por_vencer_7d_usd += f.saldo; else k.por_vencer_7d_mxn += f.saldo;
      }
    }
  }
  return k;
}
