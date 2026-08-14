/**
 * Puente entre los atajos puros (`date-picker-mx-atajos`) y el input real:
 * calcula la nueva fecha y restaura la selección del segmento activo.
 */
import type { RefObject } from "react";
import { hoyMx } from "@/lib/date/mx";
import { resolverAtajo } from "./date-picker-mx-atajos";
import {
  ajustarFechaIso, ajustarPeriodo, indiceSegmento, limitarIso, seleccionarSegmento,
  type PatronSegmento,
} from "./date-picker-mx-segmentos";

export interface CtxAtajos {
  patron: readonly PatronSegmento[];
  /** ISO (`YYYY-MM-DD`) o periodo (`YYYY-MM`) desde el cual ajustar. */
  base: string;
  /** `periodo` usa aritmética `YYYY-MM`; `fecha` usa `YYYY-MM-DD`. */
  modo?: "fecha" | "periodo";
  min?: string;
  max?: string;
  aplicar: (valor: string) => void;
  inputRef: RefObject<HTMLInputElement>;
  disabled?: boolean;
  readOnly?: boolean;
}

function valorHoy(modo: "fecha" | "periodo"): string {
  const hoy = hoyMx();
  return modo === "periodo" ? hoy.slice(0, 7) : hoy;
}

function ajustar(valor: string, modo: "fecha" | "periodo", tipo: Parameters<typeof ajustarFechaIso>[1], delta: number): string {
  return modo === "periodo"
    ? ajustarPeriodo(valor, tipo, delta)
    : ajustarFechaIso(valor, tipo, delta);
}

/** Devuelve `true` si la tecla fue consumida por los aceleradores. */
export function manejarAtajosSegmento(
  e: React.KeyboardEvent<HTMLInputElement>,
  ctx: CtxAtajos,
): boolean {
  const { patron, min, max, aplicar, inputRef, disabled, readOnly } = ctx;
  if (disabled || readOnly) return false;

  const accion = resolverAtajo(e);
  if (!accion) return false;

  const modo = ctx.modo ?? "fecha";
  const input = inputRef.current;
  const indice = indiceSegmento(patron, input?.selectionStart ?? 0);

  if (accion.tipo === "mover") {
    const destino = Math.min(Math.max(indice + accion.dir, 0), patron.length - 1);
    if (destino === indice) return false;
    e.preventDefault();
    seleccionarSegmento(input, patron, destino);
    return true;
  }

  e.preventDefault();
  const base = ctx.base || valorHoy(modo);

  let siguiente: string;
  if (accion.tipo === "hoy") {
    siguiente = valorHoy(modo);
  } else if (accion.tipo === "ajustarUnidad") {
    siguiente = ajustar(base, modo, accion.unidad, accion.delta);
  } else {
    siguiente = ajustar(base, modo, patron[indice].tipo, accion.delta);
  }

  aplicar(limitarIso(siguiente, min, max));
  requestAnimationFrame(() => seleccionarSegmento(inputRef.current, patron, indice));
  return true;
}

/** Selecciona el segmento donde el usuario hizo clic o al recibir el foco. */
export function seleccionarSegmentoEnCursor(
  input: HTMLInputElement | null,
  patron: readonly PatronSegmento[],
): void {
  if (!input || !input.value) return;
  seleccionarSegmento(input, patron, indiceSegmento(patron, input.selectionStart ?? 0));
}
