/**
 * Constructores de ruta del checklist de cierre.
 * Extraído de `cierreCheckMeta.ts` (v13.387.2) para respetar el límite de
 * 200 líneas por archivo (Power of 10).
 */
import { pick } from "./cierreCheckFormatters";
import { ROUTES } from "@/constants/routes";

/** Construye una ruta con tab + focus opcionales. */
export const buildRuta = (tab: string, focus?: string) =>
  (id: string, _detalle?: unknown, _expediente?: string): string => {
    const params = new URLSearchParams({ tab });
    if (focus) params.set("focus", focus);
    return `/embarques/${id}?${params.toString()}`;
  };

/** Versión que extrae `ids` del detalle (para contenedores). */
export const rutaContenedores = (id: string, detalle?: unknown, _expediente?: string): string => {
  const ids = pick(detalle, "ids");
  const params = new URLSearchParams({ tab: "resumen", focus: "contenedores" });
  if (Array.isArray(ids) && ids.length > 0) {
    params.set("ids", ids.map(String).join(","));
  }
  return `/embarques/${id}?${params.toString()}`;
};

/**
 * v13.385.0 — Las comisiones devengadas NO viven en el P&L del embarque (ahí
 * `focus=comision` apuntaba a la tabla de proveedores). El módulo Comisiones es
 * donde realmente se consultan y resuelven, filtrado por expediente vía `?q=`.
 */
export const rutaComisiones = (_id: string, _detalle?: unknown, expediente?: string): string => {
  const exp = (expediente ?? "").trim();
  return exp ? `${ROUTES.COMISIONES}?q=${encodeURIComponent(exp)}` : ROUTES.COMISIONES;
};
