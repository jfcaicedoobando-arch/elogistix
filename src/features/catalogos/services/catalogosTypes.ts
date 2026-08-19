/**
 * Tipos de los catálogos compartidos (navieras, puertos, tipos de contenedor
 * y tipo de cambio).
 *
 * Ola 20 · paso 4: vive aparte de los servicios para que importar un tipo no
 * arrastre el cliente de base de datos.
 */

export interface Naviera {
  id: string;
  code: string;
  name: string;
  activo: boolean;
  created_at: string;
  tracking_url_template: string | null;
}

export interface Puerto {
  id: string;
  code: string;
  name: string;
  country: string;
  activo: boolean;
  created_at: string;
}

export interface TipoContenedor {
  id: string;
  code: string;
  name: string;
  activo: boolean;
  created_at: string;
}

export interface ExchangeRates {
  usdMxn: number;
  eurMxn: number;
  /** Fecha (ISO YYYY-MM-DD) del FIX efectivamente aplicado por Banxico. Sólo
   *  la edge la devuelve; puede quedar undefined si viene del fallback. */
  fechaAplicada?: string;
  /** FIX-10: `true` si los valores vienen del fallback (Banxico caído, sin token,
   *  error de red). Los flujos fiscales DEBEN rechazar rates con este flag. */
  esFallback?: boolean;
  /** EF-04: `true` si el EUR es estimado (18.5) aunque el USD sea real. Los
   *  flujos en moneda EUR DEBEN rechazar/marcar el TC cuando este flag está. */
  eurEsFallback?: boolean;
}

/** Límite defensivo de catálogos (PostgREST corta a max-rows sin avisar). */
export const LIMITE_CATALOGOS = 500;
