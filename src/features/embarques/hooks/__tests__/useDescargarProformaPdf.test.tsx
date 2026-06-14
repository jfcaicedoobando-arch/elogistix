import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({
  useTasaIVA: () => 0.16,
}));
vi.mock("@/hooks/shared", () => ({
  toast: vi.fn(),
}));
vi.mock("@/services/proforma", () => ({
  fetchClienteParaPdf: vi.fn().mockResolvedValue({ id: "cli-1" }),
  fetchConceptosProforma: vi.fn().mockResolvedValue([]),
  fetchConceptosConsolidados: vi.fn().mockResolvedValue([]),
  fetchEmbarqueParaPdf: vi.fn().mockResolvedValue({ id: "e-1", expediente: "EXP-001" }),
}));
vi.mock("@/generators/proformaPdf", () => ({
  generarPdfProforma: vi.fn().mockResolvedValue(undefined),
}));

import { useDescargarProformaPdf } from "../useDescargarProformaPdf";

const proformaStub = {
  id: "pf-1", embarque_id: "e-1", cliente_id: "cli-1", es_consolidada: false,
} as Parameters<ReturnType<typeof useDescargarProformaPdf>["descargar"]>[0];

describe("useDescargarProformaPdf", () => {
  it("inicia con downloadingId null", () => {
    const { result } = renderHook(() => useDescargarProformaPdf(), { wrapper: createWrapper() });
    expect(result.current.downloadingId).toBeNull();
  });

  it("establece downloadingId durante la descarga y lo limpia al terminar", async () => {
    const { result } = renderHook(() => useDescargarProformaPdf(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.descargar(proformaStub);
    });
    expect(result.current.downloadingId).toBeNull();
  });

  it("maneja error sin lanzar al caller", async () => {
    const { fetchEmbarqueParaPdf } = await import("@/services/proforma");
    vi.mocked(fetchEmbarqueParaPdf).mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useDescargarProformaPdf(), { wrapper: createWrapper() });
    await expect(act(async () => result.current.descargar(proformaStub))).resolves.not.toThrow();
    expect(result.current.downloadingId).toBeNull();
  });
});
