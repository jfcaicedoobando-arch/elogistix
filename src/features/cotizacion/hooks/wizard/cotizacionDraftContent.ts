import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import type { ConceptoVentaCotizacion, FilaCostoLocal } from "@/features/cotizacion/types";
import { ventasTienenContenido } from "./cotizacionDraftVentas";

/**
 * R-09 — Un borrador sólo se escribe si tiene algo que recordar. Sin esto, el
 * primer ciclo de autosave (que corre al montar, con el formulario vacío)
 * sobrescribía el borrador guardado y "Restaurar" devolvía campos en blanco.
 */
/**
 * Claves del formulario con un valor por defecto no-vacío (ver
 * `COTIZACION_FORM_DEFAULTS`): deben excluirse porque siempre están
 * "presentes" aunque el usuario no haya tocado nada, y por eso hacían que
 * el borrador se considerara "con contenido" desde el primer render.
 */
const CLAVES_SIN_SEÑAL: ReadonlySet<string> = new Set(["prospectoModo"]);

export function draftTieneContenido(values: CotizacionFormValues, costos: FilaCostoLocal[], ventas: ConceptoVentaCotizacion[] = []): boolean {
  if (costos.length > 0 || ventasTienenContenido(ventas)) return true;
  // SAFE-CAST: sólo se recorren las claves del formulario para detectar si hay
  // algún valor capturado; no se accede a ningún campo de forma tipada.
  const v = values as unknown as Record<string, unknown>;

  return Object.entries(v).some(([clave, valor]) => {
    if (CLAVES_SIN_SEÑAL.has(clave)) return false;
    if (typeof valor === "string") return valor.trim().length > 0;
    if (typeof valor === "number") return valor !== 0;
    if (Array.isArray(valor)) return valor.length > 0;
    return false;
  });
}
