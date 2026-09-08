/**
 * R219-UI-02 — Opción sintética para selectores de "Tipo de contenedor".
 *
 * Los contenedores heredados de una cotización con tarifa guardan el UUID del
 * catálogo, mientras que los selectores listan `code`. Sin una opción con el
 * valor guardado, Radix pintaba el campo VACÍO (aunque el dato existía) y el
 * resumen llegaba a mostrar el UUID crudo.
 *
 * Este helper devuelve la opción a inyectar cuando el valor guardado no está
 * entre las opciones del catálogo, preservando el valor tal cual (sin
 * convertir datos) y mostrando un nombre legible.
 */
import {
  resolveTipoContenedorNombre,
  type TipoContenedorCatalogo,
} from "@/features/cotizacion/utils/resolveTipoContenedorNombre";

export interface OpcionTipoContenedor {
  value: string;
  label: string;
}

/**
 * @param valorGuardado Valor persistido (UUID de catálogo o `code`/nombre legacy).
 * @param catalogo Catálogo cargado; puede llegar vacío (carga tardía).
 * @param valoresOpciones Valores que YA ofrece el selector (por defecto los `code`).
 */
export function opcionTipoGuardada(
  valorGuardado: string | null | undefined,
  catalogo: ReadonlyArray<TipoContenedorCatalogo>,
  valoresOpciones?: ReadonlyArray<string>,
): OpcionTipoContenedor | null {
  const v = (valorGuardado ?? "").trim();
  if (!v) return null;

  const valores = valoresOpciones ?? catalogo.map((t) => t.code ?? "");
  if (valores.some((o) => o === v)) return null;

  // `resolveTipoContenedorNombre` devuelve el texto tal cual para valores
  // legacy ("20' GP") y "" sólo cuando es un UUID que no está en el catálogo
  // cargado (o quedó inactivo). Sólo en ese caso ocultamos el identificador.
  const nombre = resolveTipoContenedorNombre(v, catalogo, "");
  return {
    value: v,
    label: nombre || "Tipo guardado (no disponible en el catálogo)",
  };
}

