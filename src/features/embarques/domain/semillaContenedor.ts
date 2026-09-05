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

/** true cuando ninguna fila tiene cantidades capturadas (todas en cero). */
export function contenedoresSinCantidades(filas: ContenedorBorrador[]): boolean {
  return filas.every(
    (f) => num(f.peso_kg) === 0 && num(f.volumen_m3) === 0 && num(f.piezas) === 0,
  );
}

/** true cuando hay cantidades generales capturadas. */
export function hayCantidadesGenerales(generales: CantidadesGenerales): boolean {
  return (
    num(generales.pesoKg) > 0 || num(generales.volumenM3) > 0 || num(generales.piezas) > 0
  );
}

/**
 * v13.823.152 (B4) — ¿Se perderían las cantidades generales al derivar los
 * totales de los contenedores? Sólo cuando hay cantidades generales capturadas
 * y NINGUNA fila tiene cantidades. Si el operador ya capturó cantidades por
 * contenedor (incluida una corrección explícita a cero en una fila mientras
 * otra tiene valores) no aplica: la verdad ya vive en los hijos.
 */
export function requiereConservarGenerales(
  filas: ContenedorBorrador[],
  generales: CantidadesGenerales,
): boolean {
  return hayCantidadesGenerales(generales) && contenedoresSinCantidades(filas);
}

/**
 * Transfiere una sola vez las cantidades generales a la PRIMERA fila, sin
 * acumular y sin tocar el resto de filas ni sus datos (número/tipo/BL).
 * Si no hace falta conservar, devuelve la lista tal cual (misma referencia).
 */
export function conservarGeneralesEnContenedores(
  filas: ContenedorBorrador[],
  generales: CantidadesGenerales,
): ContenedorBorrador[] {
  if (!hayCantidadesGenerales(generales)) return filas;
  if (filas.length === 0) return [contenedorSembradoDesdeGenerales(generales)];
  if (!contenedoresSinCantidades(filas)) return filas;
  return filas.map((f, i) =>
    i === 0
      ? {
          ...f,
          peso_kg: num(generales.pesoKg),
          volumen_m3: num(generales.volumenM3),
          piezas: num(generales.piezas),
        }
      : f,
  );
}
