import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useDialogGenerarProformaController } from "../useDialogGenerarProformaController";
import { ProformaValidationError } from "@/features/embarques/services/submitProformaDialog";

const hoisted = vi.hoisted(() => ({
  submitMock: vi.fn(),
  toastMock: vi.fn(),
  captureMock: vi.fn(),
}));

vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({
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

vi.mock("@/features/embarques/services/submitProformaDialog", async () => {
  const actual = await vi.importActual<typeof import("@/features/embarques/services/submitProformaDialog")>(
    "@/features/embarques/services/submitProformaDialog",
  );
  return {
    ...actual,
    submitProformaDialog: (...args: unknown[]) => hoisted.submitMock(...args),
  };
});

vi.mock("@/hooks/shared", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/hooks/shared");
  return { ...actual, toast: (...args: unknown[]) => hoisted.toastMock(...args) };
});

vi.mock("@sentry/react", () => ({
  captureException: (...args: unknown[]) => hoisted.captureMock(...args),
}));

const mockEmbarque = { id: "emb-1", cliente_id: "cli-1" } as any;
const mockConceptos = [
  { id: "c1", descripcion: "C1", cantidad: 1, precio_unitario: 100, moneda: "USD", aplica_iva: true },
  { id: "c2", descripcion: "C2", cantidad: 1, precio_unitario: 200, moneda: "MXN", aplica_iva: true },
] as any;

const wrapper = createWrapper();

describe("useDialogGenerarProformaController", () => {
  beforeEach(() => {
    hoisted.submitMock.mockReset();
    hoisted.toastMock.mockReset();
    hoisted.captureMock.mockReset();
  });
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

  it("muestra toast warning sin reportar a Sentry en ProformaValidationError", async () => {
    hoisted.submitMock.mockRejectedValueOnce(new ProformaValidationError("Falta peso/volumen"));
    const onClose = vi.fn();
    const { result } = renderHook(
      () => useDialogGenerarProformaController(true, mockEmbarque, mockConceptos, onClose),
      { wrapper }
    );

    await act(async () => { await result.current.handleConfirmar(); });

    expect(hoisted.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Falta peso/volumen", variant: "warning" }),
    );
    expect(onClose).not.toHaveBeenCalled();
    // captureException se hace lazy; damos un microtick y verificamos
    await new Promise((r) => setTimeout(r, 0));
    expect(hoisted.captureMock).not.toHaveBeenCalled();
  });

  it("muestra toast destructive y reporta a Sentry en error genérico", async () => {
    hoisted.submitMock.mockRejectedValueOnce(new Error("PDF blew up"));
    const onClose = vi.fn();
    const { result } = renderHook(
      () => useDialogGenerarProformaController(true, mockEmbarque, mockConceptos, onClose),
      { wrapper }
    );

    await act(async () => { await result.current.handleConfirmar(); });

    expect(hoisted.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "PDF blew up", variant: "destructive" }),
    );
    expect(onClose).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    expect(hoisted.captureMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { feature: "proforma_generate" } }),
    );
  });
});
