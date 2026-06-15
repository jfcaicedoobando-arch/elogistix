/**
 * Catálogos y helpers específicos del modo Terrestre en cotizaciones.
 * Mantener fuera de wizardConstants.ts para no contaminar otros modos.
 */

export const MODALIDADES_EQUIPO_TERRESTRE = [
  "Caja Seca",
  "Porta Contenedor",
  "Plataforma",
  "Torton",
  "Camión Full",
  "Camión Sencillo",
] as const;

export const TIPOS_OPERACION_TERRESTRE = ["Nacional", "Cross Trade"] as const;
