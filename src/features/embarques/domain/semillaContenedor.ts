/**
 * v13.823.151 (B4) — Al pasar un embarque Marítimo a FCL, las cantidades
 * generales (peso/volumen/piezas) dejan de capturarse en "Datos generales":
 * la verdad pasa a vivir por contenedor. Antes se creaba el primer contenedor
 * en 0/0/0 y el resumen quedaba en cero, borrando en silencio lo capturado.
 *
 * Aquí se siembra ese primer contenedor con las cantidades ya capturadas
 * (una sola vez, sin acumular): la suma de hijos reproduce exactamente los
 * totales previos. Corregir a cero sigue siendo posible de forma explícita,
 * editando la fila del contenedor.
 */
import {
  crearContenedorVacio,
  type ContenedorBorrador,
} from "@/features/embarques/types/contenedor";

export interface CantidadesGenerales {
  pesoKg?: number | string | null;
  volumenM3?: number | string | null;
  piezas?: number | string | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Primer contenedor del embarque sembrado con las cantidades generales.
 * Si no había cantidades capturadas devuelve una fila vacía (comportamiento
 * anterior).
 */
export function contenedorSembradoDesdeGenerales(
  generales: CantidadesGenerales,
  orden = 1,
): ContenedorBorrador {
  return {
    ...crearContenedorVacio(orden),
    peso_kg: num(generales.pesoKg),
    volumen_m3: num(generales.volumenM3),
    piezas: num(generales.piezas),
  };
}
