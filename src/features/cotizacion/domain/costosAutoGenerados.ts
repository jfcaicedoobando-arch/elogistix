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
export type DesajusteCostos = "tarifa_cantidad" | "flete_lcl" | "tarifa_distinta";

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

/** Prefijo que marca una fila automática que el usuario ya ajustó a mano. */
export const NOTA_EDITADA_A_MANO = "Editado a mano";

/**
 * El Paso 2 anuncia "Puedes editar, agregar o eliminar conceptos". Si el
 * usuario cambia importes/proveedor/cantidad de una fila auto-generada, esa
 * fila deja de ser automática: se le quita la marca para que el detector de
 * desajuste (Q2/Q6) no la compare contra el Paso 1 ni la reemplace al
 * recalcular. Sin la marca no hay bloqueo del botón "Siguiente" ni pérdida de
 * lo capturado.
 */
export function marcarEditadaAMano<
  T extends { notas?: string; costeo_tarifa_id?: string | null; costeo_tarifa_recargo_id?: string | null },
>(fila: T): T {
  if (!esCostoAutoGenerado(fila as FilaConNota)) return fila;
  // P1-4: además se corta el linaje automático (costeo_tarifa_id/recargo): la
  // revalidación SQL ya no lo compara contra la tarifa. El origen queda
  // auditable en la nota ("Editado a mano — Auto-cargado desde …").
  const editada = { ...fila, notas: `${NOTA_EDITADA_A_MANO} — ${(fila.notas ?? "").trim()}` };
  if ("costeo_tarifa_id" in fila) editada.costeo_tarifa_id = null;
  if ("costeo_tarifa_recargo_id" in fila) editada.costeo_tarifa_recargo_id = null;
  return editada;
}

/**
 * P1-3/P2-5: filas automáticas de tarifa cuyo linaje ya no es la tarifa
 * vigente (se cambió o se quitó). Las legacy sin `costeo_tarifa_id` no cuentan.
 */
export function costosAutoDeOtraTarifa(
  filas: FilaCostoLocal[],
  tarifaIdVigente: string | null | undefined,
): FilaCostoLocal[] {
  return filas.filter(
    (f) => esCostoAutoTarifa(f) && !!f.costeo_tarifa_id && f.costeo_tarifa_id !== (tarifaIdVigente ?? null),
  );
}

/** P2-5: conserva las filas de otra tarifa como manuales (sin linaje). */
export function conservarComoManuales(
  filas: FilaCostoLocal[],
  tarifaIdVigente: string | null | undefined,
): FilaCostoLocal[] {
  const ajenas = new Set(costosAutoDeOtraTarifa(filas, tarifaIdVigente));
  return filas.map((f) => (ajenas.has(f) ? marcarEditadaAMano(f) : f));
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
