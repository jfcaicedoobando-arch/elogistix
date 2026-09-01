/**
 * Ola 5 · RN-5 — primitiva de ancho para controles de filtro.
 *
 * La auditoría encontró 65 anchos arbitrarios (`w-[150px]`, `w-[168px]`,
 * `w-[210px]`, …) en las barras de filtros: cada pantalla elegía el suyo y las
 * barras quedaban desalineadas. Estas cuatro escalas cubren todos los casos.
 *
 * Uso:
 *   <SelectTrigger className={FILTRO_ANCHO.md}>…</SelectTrigger>
 */
export const FILTRO_ANCHO = {
  /** Chips cortos: moneda, estatus binario. */
  sm: "w-full sm:w-36",
  /** Default para selects de catálogo (estado, tipo, modo). */
  md: "w-full sm:w-44",
  /** Selects con nombres largos: cliente, proveedor, naviera. */
  lg: "w-full sm:w-56",
  /** Búsqueda de texto y rangos de fecha. */
  search: "w-full sm:w-72",
  /**
   * Variantes auto-ajustables (O3.7.8, patrón de Leads): crecen con la
   * etiqueta seleccionada en vez de truncarla ("Todas las vendedoras",
   * "Accionable (≤7d o vencidas)", …) conservando el mínimo de la escala.
   * Úsalas cuando las opciones del select tienen textos largos.
   */
  smAuto: "w-full sm:w-auto sm:min-w-36",
  mdAuto: "w-full sm:w-auto sm:min-w-44",
  lgAuto: "w-full sm:w-auto sm:min-w-56",
} as const;

