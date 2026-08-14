/**
 * Aceleradores de teclado de los pickers MX, resueltos como acciones puras
 * para poder probarlos sin renderizar el componente.
 *
 *  - `T` / `H`                → hoy (o mes en curso en el picker de periodo).
 *  - `+` / `=` / `Flecha ↑`   → +1 sobre el segmento activo.
 *  - `-` / `_` / `Flecha ↓`   → -1 sobre el segmento activo.
 *  - `Re Pág` / `Av Pág`      → ±1 mes (con `Shift`, ±1 año).
 *  - `Flecha ←` / `Flecha →`  → salto discreto entre segmentos.
 */
import type { SegmentoTipo } from "./date-picker-mx-segmentos";

export type AccionAtajo =
  | { tipo: "hoy" }
  /** Ajusta el segmento donde está el cursor. */
  | { tipo: "ajustar"; delta: number }
  /** Ajusta una unidad fija, sin importar el segmento activo. */
  | { tipo: "ajustarUnidad"; unidad: SegmentoTipo; delta: number }
  | { tipo: "mover"; dir: -1 | 1 };

interface EventoTecla {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export function resolverAtajo(e: EventoTecla): AccionAtajo | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;

  const k = e.key;
  if (k === "t" || k === "T" || k === "h" || k === "H") return { tipo: "hoy" };
  if (k === "+" || k === "=" || k === "ArrowUp") return { tipo: "ajustar", delta: 1 };
  if (k === "-" || k === "_" || k === "ArrowDown") return { tipo: "ajustar", delta: -1 };
  if (k === "PageUp") {
    return { tipo: "ajustarUnidad", unidad: e.shiftKey ? "anio" : "mes", delta: 1 };
  }
  if (k === "PageDown") {
    return { tipo: "ajustarUnidad", unidad: e.shiftKey ? "anio" : "mes", delta: -1 };
  }
  if (k === "ArrowLeft") return { tipo: "mover", dir: -1 };
  if (k === "ArrowRight") return { tipo: "mover", dir: 1 };
  return null;
}
