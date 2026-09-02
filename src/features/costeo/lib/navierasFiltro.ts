/**
 * Búsqueda y filtro segmentado del catálogo de navieras (Costeo y Portal Agente).
 * Búsqueda normalizada (sin acentos, sin importar mayúsculas).
 */

export type EstadoNavieraFiltro = "todos" | "configuradas" | "sin_configurar";

export const ESTADO_NAVIERA_FILTRO_OPTIONS: { value: EstadoNavieraFiltro; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "configuradas", label: "Configuradas" },
  { value: "sin_configurar", label: "Sin configurar" },
];

export function normalizarBusquedaNaviera(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export interface FilaNavieraFiltrable {
  naviera_nombre: string;
  condicion: unknown | null;
}

export function filtrarNavieras<T extends FilaNavieraFiltrable>(
  filas: T[],
  busqueda: string,
  estado: EstadoNavieraFiltro,
): T[] {
  const q = normalizarBusquedaNaviera(busqueda);
  return filas.filter((f) => {
    if (q && !normalizarBusquedaNaviera(f.naviera_nombre).includes(q)) return false;
    if (estado === "configuradas" && !f.condicion) return false;
    if (estado === "sin_configurar" && f.condicion) return false;
    return true;
  });
}
