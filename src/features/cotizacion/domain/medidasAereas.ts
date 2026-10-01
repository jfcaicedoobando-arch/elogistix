import type { DimensionAerea } from "@/features/cotizacion/types";

/** Dimensiones en cm; el peso físico se captura, nunca se deduce del volumétrico. */
export function resumenDimensionesAereas(dimensiones: readonly DimensionAerea[]) {
  return dimensiones.reduce((total, d) => ({
    piezas: total.piezas + d.piezas,
    pesoVolumetricoKg: total.pesoVolumetricoKg + d.peso_volumetrico_kg,
    volumenM3: total.volumenM3 + (d.piezas * d.alto_cm * d.largo_cm * d.ancho_cm) / 1_000_000,
  }), { piezas: 0, pesoVolumetricoKg: 0, volumenM3: 0 });
}
