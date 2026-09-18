/**
 * P2-IVA — Tasa de 8% de la región fronteriza norte/sur.
 *
 * El SAT la describe como un ESTÍMULO FISCAL sujeto a aviso y requisitos
 * vigentes, no como una tasa general. Aquí sólo se define la protección
 * mínima: un interruptor por organización que Contabilidad activa cuando
 * confirma la elegibilidad, y los textos de advertencia.
 *
 * Este módulo NO verifica elegibilidad, no conoce municipios ni reglas
 * propias: sólo pide confirmación explícita y remite a la fuente oficial.
 */
import { TASA_IVA_FRONTERA_MX } from "@/lib/financial/tipoIvaSat";

/** Fuente oficial (minisitio del SAT). */
export const URL_SAT_IVA_FRONTERA =
  "https://www.sat.gob.mx/minisitio/EstimulosFiscalesFronteraNorteSur/region_fronteriza_norte_iva/";

/** Clave de configuración por organización. Ausente = deshabilitado. */
export const CONFIG_IVA_FRONTERA = {
  categoria: "facturacion",
  clave: "iva_frontera_habilitado",
} as const;

export const AVISO_IVA_FRONTERA_TITULO =
  "El 8% es un estímulo fiscal, no una tasa general";

export const AVISO_IVA_FRONTERA_TEXTO =
  "La tasa de 8% sólo aplica a contribuyentes de la región fronteriza norte/sur que " +
  "presentaron el aviso ante el SAT y cumplen los requisitos vigentes. El sistema no " +
  "verifica esa elegibilidad: confírmala con Contabilidad antes de usarla.";

export const AVISO_IVA_FRONTERA_DESHABILITADO =
  "La tasa de 8% (estímulo de región fronteriza) está deshabilitada. Contabilidad debe " +
  "activarla en Configuración → Facturación después de confirmar la elegibilidad ante el SAT.";

/** `true` cuando la tasa elegida es la del estímulo fronterizo. */
export function esTasaFrontera(tasa: number): boolean {
  return Math.abs(tasa - TASA_IVA_FRONTERA_MX) < 1e-9;
}

/**
 * ¿Se puede seleccionar esta tasa para un concepto NUEVO?
 * Los conceptos ya guardados al 8% no se tocan: esta función sólo gobierna
 * nuevas selecciones en la UI.
 */
export function tasaSeleccionable(tasa: number, fronteraHabilitada: boolean): boolean {
  return !esTasaFrontera(tasa) || fronteraHabilitada;
}
