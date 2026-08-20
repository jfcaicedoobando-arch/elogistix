/**
 * CANON ÚNICO de "vencido / por vencer" del ERP.
 *
 * Antes cada módulo lo decidía por su cuenta y los números no cuadraban entre
 * pantallas: Cobranza y Estado de Cuenta miraban `estatus_cobranza`, la bandeja
 * de Cartera comparaba `dias_vencido > 0` a mano, y CxP usaba `dias_para_vencer < 0`
 * (campo con el signo invertido). Todas las pantallas deben derivar la respuesta
 * de aquí para que un mismo conjunto de facturas dé el mismo KPI.
 *
 * Convención de signo:
 *  - `dias_vencido`      = hoy − vencimiento → positivo = ya venció.
 *  - `dias_para_vencer`  = vencimiento − hoy → negativo = ya venció.
 *
 * Sin red, sin React.
 */

/** Ventana única de la cubeta "Por vencer" en cartera (CxC). */
export const DIAS_POR_VENCER_CXC = 7;

const num = (v: number | null | undefined): number => Number(v ?? 0) || 0;

/** ¿Ya venció? (convención `dias_vencido`: positivo = vencida). */
export function esVencidoPorDias(diasVencido: number | null | undefined): boolean {
  return num(diasVencido) > 0;
}

/** ¿Ya venció? (convención `dias_para_vencer`: negativo = vencida). */
export function esVencidoPorDiasParaVencer(diasParaVencer: number | null | undefined): boolean {
  return esVencidoPorDias(-num(diasParaVencer));
}

/** ¿Cae en la ventana "Por vencer"? (incluye "vence hoy"). */
export function estaPorVencer(diasVencido: number | null | undefined): boolean {
  const d = num(diasVencido);
  return d <= 0 && d >= -DIAS_POR_VENCER_CXC;
}

/** Accionable para cobranza: ya vencida o por vencer dentro de la ventana. */
export function esAccionable(diasVencido: number | null | undefined): boolean {
  return esVencidoPorDias(diasVencido) || estaPorVencer(diasVencido);
}

/** Estatus derivado por el RPC/servicio de cobranza que significa "vencida". */
export const ESTATUS_VENCIDA = "Vencida";

/**
 * Predicado único de "factura de cliente vencida con saldo".
 * Acepta el estatus derivado o, si no viene, los días crudos: así Cobranza,
 * Estado de Cuenta, Tesorería y el Dashboard llegan al mismo número.
 */
export function esCxcVencida(f: {
  saldo?: number | null;
  estatus_cobranza?: string | null;
  estatus?: string | null;
  dias_vencido?: number | null;
}): boolean {
  if (num(f.saldo) <= 0) return false;
  const estatus = f.estatus_cobranza ?? f.estatus ?? null;
  if (estatus != null) return estatus === ESTATUS_VENCIDA;
  return esVencidoPorDias(f.dias_vencido);
}
