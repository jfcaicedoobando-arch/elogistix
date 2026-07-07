/**
 * Helper puro para `MiniSerie`. Vive fuera del archivo del componente para
 * cumplir con `react-refresh/only-export-components` (Fast Refresh sólo
 * funciona cuando un archivo exporta únicamente componentes).
 */
const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function mesLabel(ymStr: string): string {
  const [, m] = ymStr.split("-");
  const idx = Number.parseInt(m, 10) - 1;
  return NOMBRES_MES[idx] ?? ymStr;
}
