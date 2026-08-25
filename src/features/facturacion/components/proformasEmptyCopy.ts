/**
 * Copy del estado vacío del listado de proformas (sin JSX, para no romper el
 * fast-refresh del archivo de componentes).
 */
export function mensajeVacioProformas(search: string, filtroEstado: string): string {
  const q = search.trim();
  if (q) return `Sin resultados para «${q}»`;
  if (filtroEstado === "aceptada") return "Ninguna proforma aceptada pendiente de emitir";
  return "No hay proformas generadas";
}
