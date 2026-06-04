import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useDialogGenerarProformaController } from "../useDialogGenerarProformaController";

vi.mock("@/hooks/catalogos/useTasaIVA", () => ({
  useTasaIVA: () => 0.16,
}));

vi.mock("../useProformas", () => ({
  useCrearProforma: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../useProformaDialog", () => ({
  useDiasCreditoCliente: () => ({ data: 30 }),
  useFetchClienteParaPdf: () => vi.fn(),
}));

vi.mock("../useContenedoresEmbarque", () => ({
  useContenedoresEmbarque: () => ({ data: [] }),
}));

const mockEmbarque = { id: "emb-1", cliente_id: "cli-1" } as any;
const mockConceptos = [
  { id: "c1", descripcion: "C1", cantidad: 1, precio_unitario: 100, moneda: "USD" },
  { id: "c2", descripcion: "C2", cantidad: 1, precio_unitario: 200, moneda: "MXN" },
] as any;

const wrapper = createWrapper();

describe("useDialogGenerarProformaController", () => {
  it("inicializa correctamente al abrir", () => {
    const { result } = renderHook(
      () => useDialogGenerarProformaController(true, mockEmbarque, mockConceptos, vi.fn()),
      { wrapper }
    );
    
    expect(result.current.paso).toBe("seleccion");
    expect(result.current.totalSeleccionados).toBe(2);
    expect(result.current.diasCredito).toBe("30");
  });

  it("calcula totales correctamente", () => {
    const { result } = renderHook(
      () => useDialogGenerarProformaController(true, mockEmbarque, mockConceptos, vi.fn()),
      { wrapper }
    );
    
    // c1: 100 USD + 16% IVA = 116
    // c2: 200 MXN + 16% IVA = 232
    expect(result.current.totales.total_usd).toBe(116);
    expect(result.current.totales.total_mxn).toBe(232);
  });

  it("permite alternar selección", () => {
    const { result } = renderHook(
      () => useDialogGenerarProformaController(true, mockEmbarque, mockConceptos, vi.fn()),
      { wrapper }
    );
    
    act(() => {
      result.current.toggle("c1");
    });
    
    expect(result.current.totalSeleccionados).toBe(1);
    expect(result.current.seleccionados.has("c1")).toBe(false);
  });
});
