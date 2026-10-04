import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useComprasNotasCreditoController } from "../useComprasNotasCreditoController";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), descargar: vi.fn() }));
vi.mock("@/hooks/shared", async () => {
  const { useState } = await import("react");
  return {
    useFiltroUrl: (_key: string, _valores: string[], valor: string) => useState(valor),
    useTextoUrl: (_key: string, valor = "") => useState(valor),
  };
});
vi.mock("@/hooks/shared/useOrgFilter", () => ({ useOrgFilter: () => ({ organizationId: "org-test", orgListo: true }) }));
vi.mock("@/features/compras/services/notasCreditoGlobal", () => ({ listarNotasCreditoGlobal: mocks.fetch }));
vi.mock("@/lib/downloadBlob", () => ({ descargarBlob: mocks.descargar }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));

const nota = {
  id: "nc1", fecha: "2026-10-04", folio_nc: "BON-1", proveedor_nombre: "Proveedor",
  factura_folio_interno: "FP12", factura_folio_proveedor: "A-12", motivo: "Descuento",
  estado: "Aplicada", moneda: "MXN", monto: 2000, descripcion: "Bonificación guardada",
  tipo_cambio: 20, factura_moneda: "USD", factura_tipo_cambio: 20, monto_en_moneda_factura: 100,
};

beforeEach(() => { vi.clearAllMocks(); mocks.fetch.mockResolvedValue([nota]); });

describe("58/60: exportación y filtros de NC de proveedor", () => {
  it("58: CSV conserva descripción, monto nominal, ambas tasas y equivalente", async () => {
    const { result } = renderHook(useComprasNotasCreditoController, { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.handleExport());
    const csv = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(mocks.descargar.mock.calls[0][0]);
    });
    expect(csv).toContain("tipo_cambio_nc");
    expect(csv).toContain("moneda_factura");
    expect(csv).toContain("tipo_cambio_factura");
    expect(csv).toContain("equivalente_moneda_factura");
    expect(csv).toContain("2000,20,USD,20,100");
    expect(csv).toContain("Bonificación guardada");
  });
  it.each(["Borrador", "Aprobada", "Aplicada", "Cancelada"] as const)("60: filtra %s con el contrato válido", async (estado) => {
    const { result } = renderHook(useComprasNotasCreditoController, { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setEstado(estado));
    await waitFor(() => expect(mocks.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ estado }), "org-test"));
  });
  it("58: CSV conserva USD80 canónicos cuando el TC de NC25 difiere del TC de factura20", async () => {
    mocks.fetch.mockResolvedValue([{ ...nota, tipo_cambio: 25, monto_en_moneda_factura: 80 }]);
    const { result } = renderHook(useComprasNotasCreditoController, { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.handleExport());
    const csv = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(mocks.descargar.mock.calls[0][0]);
    });
    expect(csv).toContain("2000,25,USD,20,80");
  });
  it("60: error bloquea exportación y conserva señal de error, mientras vacío válido permite cero", async () => {
    mocks.fetch.mockRejectedValue(new Error("consulta fallida"));
    const { result } = renderHook(useComprasNotasCreditoController, { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    act(() => result.current.handleExport());
    expect(mocks.descargar).not.toHaveBeenCalled();
    mocks.fetch.mockResolvedValue([]);
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.totalMxn).toBe(0);
    expect(result.current.totalUsd).toBe(0);
  });
});
