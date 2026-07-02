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
});
