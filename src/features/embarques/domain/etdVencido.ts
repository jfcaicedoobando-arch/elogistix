/**
 * Helper puro: ¿el ETD de un embarque ya venció? Comparación en UTC para
 * evitar corrimientos por zona horaria (es-MX). Extraído de `AlertaBorrador`
 * para que ese archivo sólo exporte componentes (react-refresh).
 */
export function etdVencido(etd: string | null): boolean {
  if (!etd) return false;
  const now = new Date();
  const hoy = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const fecha = new Date(`${etd.slice(0, 10)}T00:00:00Z`).getTime();
  return !Number.isNaN(fecha) && fecha < hoy;
}
