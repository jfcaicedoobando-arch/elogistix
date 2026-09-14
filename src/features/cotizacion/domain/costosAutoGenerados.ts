/**
 * v13.823.396 · Auditoría cotización marítima → costos → embarque (Q2/Q4/Q5/Q6).
 *
 * Fuente única de verdad para reconocer las filas de costo que el wizard
 * generó automáticamente (tarifa marítima FCL o flete LCL manual) y poder
 * reemplazarlas SIN tocar las filas capturadas a mano por el usuario.
 *
 * La marca es la nota exacta que ya escriben `buildCostosDesdeTarifa` y
 * `buildCostosLCLManual`; no se inventa ningún campo persistido nuevo ni se
 * usa una coincidencia difusa que pudiera borrar un renglón manual.
 *
 * Sin I/O ni dependencias de UI.
 */
import type { FilaCostoLocal } from "@/features/cotizacion/types";

/** Nota exacta de las filas generadas desde una tarifa marítima (FCL). */
export const NOTA_AUTO_TARIFA = "Auto-cargado desde tarifa marítima";

/** Prefijo de la nota de la fila generada desde el Flete LCL manual. */
export const NOTA_AUTO_FLETE_LCL = "Auto-cargado desde Flete LCL manual";

/** Motivo por el que los costos automáticos quedaron desactualizados. */
export type DesajusteCostos = "tarifa_cantidad" | "flete_lcl";

type FilaConNota = Pick<FilaCostoLocal, "notas">;

/** ¿La fila la generó la tarifa marítima vinculada (flete o recargo)? */
export function esCostoAutoTarifa(fila: FilaConNota): boolean {
  return (fila.notas ?? "").trim() === NOTA_AUTO_TARIFA;
}

/** ¿La fila la generó el bloque "Flete LCL manual" del Paso 1? */
export function esCostoAutoFleteLcl(fila: FilaConNota): boolean {
  return (fila.notas ?? "").trim().startsWith(NOTA_AUTO_FLETE_LCL);
}

/** ¿La fila la generó el wizard (cualquiera de los dos servicios)? */
export function esCostoAutoGenerado(fila: FilaConNota): boolean {
  return esCostoAutoTarifa(fila) || esCostoAutoFleteLcl(fila);
}

/** Filas sin las auto-generadas desde tarifa (conserva manuales y LCL). */
export function sinCostosAutoTarifa<T extends FilaConNota>(filas: T[]): T[] {
  return filas.filter((f) => !esCostoAutoTarifa(f));
}

/** Filas sin la auto-generada del flete LCL manual (conserva el resto). */
export function sinCostosAutoFleteLcl<T extends FilaConNota>(filas: T[]): T[] {
  return filas.filter((f) => !esCostoAutoFleteLcl(f));
}

/** Filas estrictamente manuales (se descarta todo lo auto-generado). */
export function sinCostosAutoGenerados<T extends FilaConNota>(filas: T[]): T[] {
  return filas.filter((f) => !esCostoAutoGenerado(f));
}

/** Reemplaza sólo las filas de tarifa por las nuevas, al final de la lista. */
export function reemplazarCostosAutoTarifa(
  filas: FilaCostoLocal[],
  nuevas: FilaCostoLocal[],
): FilaCostoLocal[] {
  return [...sinCostosAutoTarifa(filas), ...nuevas];
}

/** Reemplaza sólo la fila del flete LCL manual por la nueva. */
export function reemplazarCostosAutoFleteLcl(
  filas: FilaCostoLocal[],
  nuevas: FilaCostoLocal[],
): FilaCostoLocal[] {
  return [...sinCostosAutoFleteLcl(filas), ...nuevas];
}

/**
 * Q2: las filas de tarifa se generan con la cantidad de contenedores vigente
 * al elegir la tarifa. Si después se cambia "Número de contenedores", la
 * cotización quedaría valuada para la cantidad anterior.
 */
export function desajusteCantidadTarifa(
  filas: FilaCostoLocal[],
  cantidadEsperada: number,
): boolean {
  const qty = Number.isFinite(cantidadEsperada) && cantidadEsperada >= 1 ? cantidadEsperada : 1;
  return filas.some((f) => esCostoAutoTarifa(f) && Number(f.cantidad) !== qty);
}

/**
 * Q6: firma de las filas automáticas de flete LCL. Compara lo persistido en
 * memoria contra lo que hoy produciría el Paso 1 (W/M, costo, venta, mínimo y
 * consolidador viajan en estos campos; el mínimo va dentro de `notas`).
 */
export function firmaFleteLclAuto(filas: FilaCostoLocal[]): string {
  return JSON.stringify(
    filas.filter(esCostoAutoFleteLcl).map((f) => ({
      q: Number(f.cantidad),
      c: Number(f.costo_unitario),
      v: Number(f.precio_venta ?? 0),
      p: (f.proveedor ?? "").trim(),
      n: (f.notas ?? "").trim(),
    })),
  );
}

/** Q6: ¿la fila automática de flete LCL ya no corresponde al Paso 1? */
export function fleteLclDesactualizado(
  filasActuales: FilaCostoLocal[],
  filasEsperadas: FilaCostoLocal[],
): boolean {
  const actuales = filasActuales.filter(esCostoAutoFleteLcl);
  if (actuales.length === 0 || filasEsperadas.length === 0) return false;
  return firmaFleteLclAuto(filasActuales) !== firmaFleteLclAuto(filasEsperadas);
}
