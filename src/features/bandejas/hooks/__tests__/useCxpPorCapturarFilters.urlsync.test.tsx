/**
 * Tests del hook `useCxpPorCapturarFilters` con URL sync (Ola 1 · Filtros globales).
 *
 * Los helpers puros (`aplicarFiltros`, `estatusDeFila`) ya viven en el archivo
 * hermano; aquí verificamos que el nuevo `nuqs` layer preserva la firma pública
 * y no rompe reset/set/toggleDireccion.
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { useCxpPorCapturarFilters } from "@/features/bandejas/hooks/useCxpPorCapturarFilters";
import type { CxpPorCapturarRow } from "@/features/bandejas/services/bandejas";

const wrapper = withNuqsTestingAdapter({ hasMemory: true });

const rows: CxpPorCapturarRow[] = [
  { embarque_id: "a", expediente: "EXP-001", cliente_nombre: "Acme",  costos_presupuestados: 100, monto_facturado:   0, facturas_capturadas: 0, ultima_factura_fecha: null, dias_desde_ultima_factura: null },
  { embarque_id: "b", expediente: "EXP-002", cliente_nombre: "Beta",  costos_presupuestados: 900, monto_facturado: 900, facturas_capturadas: 2, ultima_factura_fecha: null, dias_desde_ultima_factura: 45 },
  { embarque_id: "c", expediente: "EXP-003", cliente_nombre: "Gamma", costos_presupuestados: 500, monto_facturado: 250, facturas_capturadas: 1, ultima_factura_fecha: null, dias_desde_ultima_factura: 3 },
];

describe("useCxpPorCapturarFilters (URL sync)", () => {
  it("inicializa con defaults y sin filtrar", () => {
    const { result } = renderHook(() => useCxpPorCapturarFilters(rows), { wrapper });
    expect(result.current.state.query).toBe("");
    expect(result.current.state.estatus).toBe("todos");
    expect(result.current.state.antiguedad).toBe("todos");
    expect(result.current.state.ordenarPor).toBe("antiguedad");
    expect(result.current.state.direccion).toBe("desc");
    expect(result.current.isFiltered).toBe(false);
    expect(result.current.filtradas).toHaveLength(3);
  });

  it("set actualiza query y filtra la lista", async () => {
    const { result } = renderHook(() => useCxpPorCapturarFilters(rows), { wrapper });
    await act(async () => { result.current.set("query", "beta"); });
    expect(result.current.state.query).toBe("beta");
    expect(result.current.isFiltered).toBe(true);
    expect(result.current.filtradas.map((r) => r.embarque_id)).toEqual(["b"]);
  });

  it("set actualiza estatus y filtra por completo", async () => {
    const { result } = renderHook(() => useCxpPorCapturarFilters(rows), { wrapper });
    await act(async () => { result.current.set("estatus", "completo"); });
    expect(result.current.state.estatus).toBe("completo");
    expect(result.current.filtradas.map((r) => r.embarque_id)).toEqual(["b"]);
  });

  it("toggleDireccion alterna asc/desc", async () => {
    const { result } = renderHook(() => useCxpPorCapturarFilters(rows), { wrapper });
    expect(result.current.state.direccion).toBe("desc");
    await act(async () => { result.current.toggleDireccion(); });
    expect(result.current.state.direccion).toBe("asc");
    await act(async () => { result.current.toggleDireccion(); });
    expect(result.current.state.direccion).toBe("desc");
  });

  it("reset limpia todos los filtros", async () => {
    const { result } = renderHook(() => useCxpPorCapturarFilters(rows), { wrapper });
    await act(async () => { result.current.set("query", "beta"); });
    await act(async () => { result.current.set("estatus", "completo"); });
    await act(async () => { result.current.set("antiguedad", "gt30"); });
    expect(result.current.isFiltered).toBe(true);
    await act(async () => { result.current.reset(); });
    expect(result.current.state.query).toBe("");
    expect(result.current.state.estatus).toBe("todos");
    expect(result.current.state.antiguedad).toBe("todos");
    expect(result.current.isFiltered).toBe(false);
    expect(result.current.filtradas).toHaveLength(3);
  });
});
