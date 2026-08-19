/**
 * Nombres canónicos de tipos de contenedor marítimo (fuente única, B-028).
 *
 * El paso 1 del wizard de cotización usa esta lista directamente; el diálogo
 * "Buscar tarifa" lee la tabla `tipos_contenedor` (catálogo administrable) y
 * usa estos nombres como referencia/fallback documental. El seed SQL de la
 * migración `20260728120500_seed_tipos_contenedor.sql` (B-031) crea los
 * mismos 12 tipos con `code` corto en mayúsculas.
 */
export const TIPOS_CONTENEDOR_DEFAULT = [
  "20' GP", "20' Dry", "20' High Cube", "20' Reefer", "20' Open Top", "20' Flat Rack",
  "40' Dry", "40' High Cube", "40' Reefer", "40' Open Top", "40' Flat Rack",
  "45' High Cube",
] as const;
