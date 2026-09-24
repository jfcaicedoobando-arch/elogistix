import { formatNumber } from "@/lib/formatters";

interface DimLcl { piezas?: number | null; volumen_m3?: number | null }

/** "4 piezas, 950 kg, 3.84 m³" — carga LCL sin contenedor físico. */
export function textoCargaLcl(piezas: number, pesoKg: number, volumenM3: number): string {
  return `${formatNumber(piezas)} piezas, ${formatNumber(pesoKg)} kg, ${formatNumber(volumenM3, { decimals: 2 })} m³`;
}

export function resumenCargaLcl(
  dims: ReadonlyArray<DimLcl> | null | undefined,
  pesoKg: number | string | null | undefined,
): string {
  const lista = dims ?? [];
  const piezas = lista.reduce((s, d) => s + (Number(d.piezas) || 0), 0);
  const volumen = lista.reduce((s, d) => s + (Number(d.volumen_m3) || 0), 0);
  return textoCargaLcl(piezas, Number(pesoKg) || 0, volumen);
}

/** W/M = mayor entre m³ y toneladas; flete = max(W/M × tarifa, mínimo). */
export function calcularFleteLcl(tarifaWm: number, minimo: number | null, m3: number, kg: number) {
  const wm = Math.max(m3, kg / 1000);
  return { wm, costo: Math.max(wm * tarifaWm, minimo ?? 0) };
}
