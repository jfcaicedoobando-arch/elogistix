/**
 * Reglas de "item activo" del sidebar. Extraído de `SidebarGroupBlock.tsx`
 * para respetar el límite de 200 líneas (Power of 10).
 */
import type { LucideIcon } from "lucide-react";

export interface SidebarItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Si se define, se usa este conteo en lugar de `totalAlertas`. */
  badgeCount?: number;
  /** Texto del tooltip del badge: explica de qué está compuesto el conteo. */
  badgeHint?: string;
}

export function isActive(
  pathname: string,
  search: string,
  path: string,
  exact: boolean,
  queriesHermanas: string[] = [],
): boolean {
  // v13.388.1 — Items de bandeja llevan query (`/proformas?estado=aceptada`):
  // sólo se marcan activos cuando la query actual coincide. El item base sigue
  // resaltando con cualquier otra query (`?tab=`, `?focus=`), salvo que la query
  // actual pertenezca a un item hermano de la misma ruta.
  const [rutaBase, query = ""] = path.split("?");
  const searchActual = search.startsWith("?") ? search.slice(1) : search;
  if (query) return pathname === rutaBase && searchActual === query;
  if (searchActual && queriesHermanas.includes(searchActual) && pathname === rutaBase) return false;
  if (rutaBase === "/" || exact) return pathname === rutaBase;
  return pathname === rutaBase || pathname.startsWith(`${rutaBase}/`);
}

/** Queries de otros items que apuntan a la misma ruta base que `item`. */
export function queriesHermanasDe(items: SidebarItem[], item: SidebarItem): string[] {
  const base = item.url.split("?")[0];
  return items
    .filter((otro) => otro !== item && otro.url.split("?")[0] === base && otro.url.includes("?"))
    .map((otro) => otro.url.split("?")[1] ?? "");
}

/** ¿El item debe compararse de forma exacta (existe otro item hijo suyo)? */
export function esExacto(items: SidebarItem[], item: SidebarItem): boolean {
  return items.some((other) => other !== item && other.url.startsWith(`${item.url}/`));
}
