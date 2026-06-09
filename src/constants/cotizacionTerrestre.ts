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

export type ModalidadEquipoTerrestre = (typeof MODALIDADES_EQUIPO_TERRESTRE)[number];

export const TIPOS_OPERACION_TERRESTRE = ["Nacional", "Cross Trade"] as const;

/** Modalidades que requieren un tercer punto (carga/descarga) entre origen y destino. */
export function requiereTresPuntos(modalidad: string | undefined | null): boolean {
  return modalidad === "Porta Contenedor";
}
