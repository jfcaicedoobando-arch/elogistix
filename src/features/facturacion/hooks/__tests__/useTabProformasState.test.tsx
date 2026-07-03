import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTabProformasState } from "../useTabProformasState";
import type { ProformaConFactura } from "@/features/embarques/hooks/useProformas";

const p = (overrides: Partial<ProformaConFactura> = {}): ProformaConFactura => ({
  id: "p1", numero: "P-001", expediente: "EXP-001", cliente_nombre: "ACME",
  operador: "Op", dias_credito: 30, subtotal_usd: 100, iva_usd: 16, total_usd: 116,
  subtotal_mxn: 1000, iva_mxn: 160, total_mxn: 1160,
  fecha_emision: "2024-01-15", estado_proforma: "pendiente",
  folio_factura_externa: null, fecha_facturacion: null,
  ...overrides,
} as ProformaConFactura);

describe("useTabProformasState", () => {
  it("filtra por search sobre cliente_nombre", () => {
    const proformas = [p(), p({ id: "p2", numero: "P-002", cliente_nombre: "Beta Corp", expediente: "EXP-002" })];
    const { result } = renderHook(() => useTabProformasState(proformas));
    act(() => { result.current.setSearch("beta"); });
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].cliente_nombre).toBe("Beta Corp");
  });

  it("filtra por estado y actualiza counts", () => {
    const proformas = [
      p({ estado_proforma: "pendiente" }),
      p({ id: "p2", numero: "P-002", expediente: "EXP-002", estado_proforma: "facturada" }),
    ];
    const { result } = renderHook(() => useTabProformasState(proformas));
    expect(result.current.counts.todas).toBe(2);
    expect(result.current.counts.facturada).toBe(1);
    act(() => { result.current.setFiltroEstado("facturada"); });
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].estado_proforma).toBe("facturada");
  });

  it("isInRange excluye proformas fuera del rango", () => {
    const proformas = [p({ fecha_emision: "2024-01-15" }), p({ id: "p2", numero: "P-002", expediente: "EXP-002", fecha_emision: "2024-03-01" })];
    const isInRange = (f: string | null | undefined) => f?.startsWith("2024-01") ?? false;
    const { result } = renderHook(() => useTabProformasState(proformas, isInRange));
    expect(result.current.filtered).toHaveLength(1);
  });

  it("filtra por cliente, operador y rango de fecha_emision", () => {
    const proformas = [
      p({ cliente_id: "c1", operador: "ana@x.com", fecha_emision: "2024-02-10" }),
      p({ id: "p2", numero: "P-002", expediente: "EXP-002", cliente_id: "c2", operador: "beto@x.com", fecha_emision: "2024-05-05" }),
      p({ id: "p3", numero: "P-003", expediente: "EXP-003", cliente_id: "c1", operador: "beto@x.com", fecha_emision: "2024-05-20" }),
    ];
    const { result } = renderHook(() => useTabProformasState(proformas));

    act(() => { result.current.setFiltroCliente("c1"); });
    expect(result.current.filtered.map((r) => r.id)).toEqual(["p1", "p3"]);

    act(() => { result.current.setFiltroOperador("beto@x.com"); });
    expect(result.current.filtered.map((r) => r.id)).toEqual(["p3"]);

    act(() => {
      result.current.setFechaDesde("2024-05-01");
      result.current.setFechaHasta("2024-05-31");
    });
    expect(result.current.filtered.map((r) => r.id)).toEqual(["p3"]);

    // clearAll debe reponer todos
    act(() => { result.current.clearAll(); });
    expect(result.current.filtered).toHaveLength(3);
  });

  it("expone listas de clientes y operadores únicos y ordenados", () => {
    const proformas = [
      p({ cliente_id: "c2", cliente_nombre: "Beta", operador: "zoe@x.com" }),
      p({ id: "p2", numero: "P-002", expediente: "EXP-002", cliente_id: "c1", cliente_nombre: "Acme", operador: "ana@x.com" }),
      p({ id: "p3", numero: "P-003", expediente: "EXP-003", cliente_id: "c1", cliente_nombre: "Acme", operador: "ana@x.com" }),
    ];
    const { result } = renderHook(() => useTabProformasState(proformas));
    expect(result.current.clientesDisponibles.map((c) => c.nombre)).toEqual(["Acme", "Beta"]);
    expect(result.current.operadoresDisponibles).toEqual(["ana@x.com", "zoe@x.com"]);
  });
});

