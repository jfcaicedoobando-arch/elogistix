/**
 * Estado local de filtros, búsqueda y orden para la bandeja CxP — Por capturar.
 * Lógica pura testeable; no toca React Query.
 *
 * v13.173.2 (Ola 1 · Filtros globales) — el estado se sincroniza con la URL vía
 * `nuqs` (`?q=`, `?estatus=`, `?antiguedad=`, `?sort=`, `?dir=`) para que los
 * filtros sean compartibles y sobrevivan al refresh, igual que en Cartera y
 * las demás bandejas migradas al primitivo unificado.
 */
import { useCallback, useMemo } from "react";
import { useQueryStates, parseAsString, parseAsStringLiteral } from "nuqs";
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

/** Defaults exportados para reset y tests. */
export const INITIAL_CXP_CAPTURAR_FILTERS: FiltersState = {
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

function coincideQuery(r: CxpPorCapturarRow, q: string): boolean {
  if (!q) return true;
  const exp = (r.expediente ?? "").toLowerCase();
  const cli = (r.cliente_nombre ?? "").toLowerCase();
  return exp.includes(q) || cli.includes(q);
}

function coincideAntiguedad(r: CxpPorCapturarRow, a: AntiguedadFiltro): boolean {
  if (a === "todos") return true;
  const d = r.dias_desde_ultima_factura;
  if (a === "sin_captura") return d == null;
  if (a === "gt7") return d != null && d > 7;
  if (a === "gt30") return d != null && d > 30;
  return true;
}

/** Aplica filtros y orden a la lista. Función pura. */
export function aplicarFiltros(
  rows: CxpPorCapturarRow[],
  f: FiltersState,
): CxpPorCapturarRow[] {
  const q = f.query.trim().toLowerCase();
  const filtradas = rows.filter((r) => {
    if (!coincideQuery(r, q)) return false;
    if (f.estatus !== "todos" && estatusDeFila(r) !== f.estatus) return false;
    if (!coincideAntiguedad(r, f.antiguedad)) return false;
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

const ESTATUS_VALUES = ["todos", "sin", "parcial", "completo"] as const;
const ANTIGUEDAD_VALUES = ["todos", "sin_captura", "gt7", "gt30"] as const;
const ORDEN_VALUES = ["expediente", "antiguedad", "monto", "facturas"] as const;
const DIR_VALUES = ["asc", "desc"] as const;

export function useCxpPorCapturarFilters(rows: CxpPorCapturarRow[]) {
  const [urlState, setUrlState] = useQueryStates({
    q: parseAsString.withDefault(""),
    estatus: parseAsStringLiteral(ESTATUS_VALUES).withDefault("todos"),
    antiguedad: parseAsStringLiteral(ANTIGUEDAD_VALUES).withDefault("todos"),
    sort: parseAsStringLiteral(ORDEN_VALUES).withDefault("antiguedad"),
    dir: parseAsStringLiteral(DIR_VALUES).withDefault("desc"),
  });

  const state: FiltersState = useMemo(
    () => ({
      query: urlState.q,
      estatus: urlState.estatus,
      antiguedad: urlState.antiguedad,
      ordenarPor: urlState.sort,
      direccion: urlState.dir,
    }),
    [urlState.q, urlState.estatus, urlState.antiguedad, urlState.sort, urlState.dir],
  );

  const set = useCallback(
    <K extends keyof FiltersState>(k: K, v: FiltersState[K]) => {
      const keyMap: Record<keyof FiltersState, "q" | "estatus" | "antiguedad" | "sort" | "dir"> = {
        query: "q",
        estatus: "estatus",
        antiguedad: "antiguedad",
        ordenarPor: "sort",
        direccion: "dir",
      };
      const urlKey = keyMap[k];
      const defaults: Record<string, string> = {
        q: "",
        estatus: "todos",
        antiguedad: "todos",
        sort: "antiguedad",
        dir: "desc",
      };
      // null cuando es default → URL limpia.
      setUrlState({ [urlKey]: v === defaults[urlKey] ? null : (v as string) });
    },
    [setUrlState],
  );

  const toggleDireccion = useCallback(() => {
    // desc es el default → "asc" se serializa; volver a "desc" borra el param.
    setUrlState({ dir: urlState.dir === "asc" ? null : "asc" });
  }, [setUrlState, urlState.dir]);

  const reset = useCallback(() => {
    setUrlState({ q: null, estatus: null, antiguedad: null, sort: null, dir: null });
  }, [setUrlState]);

  const filtradas = useMemo(() => aplicarFiltros(rows, state), [rows, state]);
  const isFiltered =
    state.query !== "" || state.estatus !== "todos" || state.antiguedad !== "todos";

  return { state, set, toggleDireccion, reset, filtradas, isFiltered };
}
