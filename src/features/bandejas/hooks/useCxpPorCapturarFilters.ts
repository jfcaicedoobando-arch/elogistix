/**
 * Estado local de filtros, búsqueda y orden para la bandeja CxP — Por capturar.
 * Lógica pura testeable; no toca React Query.
 */
import { useMemo, useState } from "react";
import type { CxpPorCapturarRow } from "@/features/bandejas/services/bandejas";

export type EstatusFiltro = "todos" | "sin" | "parcial" | "completo";
export type AntiguedadFiltro = "todos" | "sin_captura" | "gt7" | "gt30";
export type OrdenarPor = "expediente" | "antiguedad" | "monto" | "facturas";
export type DireccionOrden = "asc" | "desc";

export interface FiltersState {
  query: string;
  estatus: EstatusFiltro;
  antiguedad: AntiguedadFiltro;
  ordenarPor: OrdenarPor;
  direccion: DireccionOrden;
}

const initial: FiltersState = {
  query: "",
  estatus: "todos",
  antiguedad: "todos",
  ordenarPor: "antiguedad",
  direccion: "desc",
};

/** Determina el estatus de captura a partir de los montos. */
export function estatusDeFila(row: CxpPorCapturarRow): EstatusFiltro {
  if (row.facturas_capturadas === 0) return "sin";
  const presup = Number(row.costos_presupuestados) || 0;
  const fact = Number(row.monto_facturado) || 0;
  if (presup > 0 && fact >= presup) return "completo";
  return "parcial";
}

/** Aplica filtros y orden a la lista. Función pura. */
export function aplicarFiltros(
  rows: CxpPorCapturarRow[],
  f: FiltersState,
): CxpPorCapturarRow[] {
  const q = f.query.trim().toLowerCase();
  const filtradas = rows.filter((r) => {
    if (q) {
      const exp = (r.expediente ?? "").toLowerCase();
      const cli = (r.cliente_nombre ?? "").toLowerCase();
      if (!exp.includes(q) && !cli.includes(q)) return false;
    }
    if (f.estatus !== "todos" && estatusDeFila(r) !== f.estatus) return false;
    if (f.antiguedad !== "todos") {
      const d = r.dias_desde_ultima_factura;
      if (f.antiguedad === "sin_captura" && d != null) return false;
      if (f.antiguedad === "gt7" && (d == null || d <= 7)) return false;
      if (f.antiguedad === "gt30" && (d == null || d <= 30)) return false;
    }
    return true;
  });

  const dir = f.direccion === "asc" ? 1 : -1;
  return [...filtradas].sort((a, b) => {
    switch (f.ordenarPor) {
      case "expediente":
        return ((a.expediente ?? "") > (b.expediente ?? "") ? 1 : -1) * dir;
      case "monto":
        return ((Number(a.costos_presupuestados) || 0) - (Number(b.costos_presupuestados) || 0)) * dir;
      case "facturas":
        return (a.facturas_capturadas - b.facturas_capturadas) * dir;
      case "antiguedad":
      default: {
        // null = sin captura → tratar como muy antiguo para orden desc
        const da = a.dias_desde_ultima_factura ?? Number.MAX_SAFE_INTEGER;
        const db = b.dias_desde_ultima_factura ?? Number.MAX_SAFE_INTEGER;
        return (da - db) * dir;
      }
    }
  });
}

export function useCxpPorCapturarFilters(rows: CxpPorCapturarRow[]) {
  const [state, setState] = useState<FiltersState>(initial);

  const set = <K extends keyof FiltersState>(k: K, v: FiltersState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const toggleDireccion = () =>
    setState((s) => ({ ...s, direccion: s.direccion === "asc" ? "desc" : "asc" }));

  const reset = () => setState(initial);

  const filtradas = useMemo(() => aplicarFiltros(rows, state), [rows, state]);
  const isFiltered =
    state.query !== "" || state.estatus !== "todos" || state.antiguedad !== "todos";

  return { state, set, toggleDireccion, reset, filtradas, isFiltered };
}
