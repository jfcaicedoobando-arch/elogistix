/**
 * Tipo de fila combinada (naviera + condición) usado en las páginas
 * de configuración de carta garantía / demoras por naviera.
 */
import type { CosteoNavieraCondicion } from "@/features/costeo/types/navieraCondicion";

export interface FilaNaviera {
  naviera_id: string;
  naviera_nombre: string;
  naviera_code: string;
  condicion: CosteoNavieraCondicion | null;
}

interface NavieraCatalogoItem {
  id: string;
  name: string;
  code: string;
}

/** Combina el catálogo de navieras con sus condiciones (si existen). */
export function combinarFilasNaviera(
  navieras: NavieraCatalogoItem[],
  condiciones: CosteoNavieraCondicion[],
): FilaNaviera[] {
  const mapa = new Map(condiciones.map((c) => [c.naviera_id, c]));
  return navieras.map((n) => ({
    naviera_id: n.id,
    naviera_nombre: n.name,
    naviera_code: n.code,
    condicion: mapa.get(n.id) ?? null,
  }));
}
