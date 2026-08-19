/**
 * BL-9 — Definición ÚNICA de la ventana "Por vencer" en cartera (CxC).
 *
 * Convivían dos umbrales: `cobranza.ts` marcaba "Por vencer" a 3 días y el KPI
 * de cartera sumaba 7 días, así que una factura a 5 días salía "Vigente" en la
 * tabla pero contaba en la tarjeta "Por vencer 7d". Ahora ambos leen de aquí.
 *
 * Convención de signo: `diasVencido < 0` = aún faltan días para vencer.
 */
export const DIAS_POR_VENCER_CXC = 7;

/** ¿La factura cae en la ventana "Por vencer" (incluye "vence hoy")? */
export function estaPorVencer(diasVencido: number): boolean {
  return diasVencido <= 0 && diasVencido >= -DIAS_POR_VENCER_CXC;
}
