/**
 * B-081 — Reglas de dominio para detectar cuándo los importes capturados en el
 * paso 2 (Costos) NO llegaron a `cotizaciones.conceptos_venta`.
 *
 * Causa raíz del bug del PDF en $0.00 (COT-2026-0167): un renglón de costo con
 * precio de venta capturado pero SIN nombre de concepto se descartaba en
 * silencio en `buildConceptosFromCostos`, así que la cotización quedaba con
 * `subtotal = 0` y el PDF imprimía ceros.
 */
import type { FilaCostoLocal } from "@/features/cotizacion/types";

export interface CostoConImportes {
  concepto: string;
  costo_unitario: number;
  precio_venta?: number | null;
  cantidad?: number;
}

/** ¿La fila tiene dinero capturado (costo o venta)? */
export function tieneImportes(fila: CostoConImportes): boolean {
  return Number(fila.costo_unitario) > 0 || Number(fila.precio_venta ?? 0) > 0;
}

/**
 * Renglones que se perderían al generar conceptos de venta: tienen importes
 * pero el concepto está vacío.
 */
export function costosSinConcepto<T extends CostoConImportes>(filas: T[]): T[] {
  return filas.filter((f) => tieneImportes(f) && !(f.concepto ?? "").trim());
}

/** Índices (base 0) de los renglones inválidos, para resaltarlos en la tabla. */
export function indicesCostosSinConcepto(filas: CostoConImportes[]): number[] {
  return filas.reduce<number[]>((acc, f, idx) => {
    if (tieneImportes(f) && !(f.concepto ?? "").trim()) acc.push(idx);
    return acc;
  }, []);
}

/** ¿Esta fila del paso 2 debe marcarse en rojo por concepto faltante? */
export function filaCostoInvalida(fila: FilaCostoLocal): boolean {
  return tieneImportes(fila) && !(fila.concepto ?? "").trim();
}

/**
 * ¿La cotización quedó "en cero" aunque los costos sí tengan precio de venta?
 * Señal para ofrecer la sincronización manual desde el detalle.
 */
export function requiereSincronizarVenta(
  costos: CostoConImportes[],
  totalConceptosVenta: number,
): boolean {
  const hayVentaEnCostos = costos.some((c) => Number(c.precio_venta ?? 0) > 0);
  return hayVentaEnCostos && totalConceptosVenta <= 0;
}
