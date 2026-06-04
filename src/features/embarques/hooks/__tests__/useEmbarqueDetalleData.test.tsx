import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.mock("@/features/embarques/services", () => ({
  fetchEmbarqueFull: mockFetch,
  fetchEmbarquesRelacionados: vi.fn(),
  fetchEventosEmbarque: vi.fn(),
  insertEventoEmbarque: vi.fn(),
  fetchEmbarquesParaExport: vi.fn(),
  fetchEmbarquesListExtras: vi.fn(),
  resolverExpediente: vi.fn(),
  subirDocumentosEmbarque: vi.fn(),
  fetchEmbarquesPaginados: vi.fn(),
  fetchEmbarqueById: vi.fn(),
  fetchEmbarqueConceptosVenta: vi.fn(),
  fetchEmbarqueConceptosCosto: vi.fn(),
  fetchExpedientesCliente: vi.fn(),
  fetchProveedoresForSelect: vi.fn(),
}));

import { useEmbarqueDetalleData } from "../useEmbarqueDetalleData";

const embarqueStub = { id: "e-1", expediente: "EXP-001", tipo_cambio_usd: "17.50", tipo_cambio_eur: "19.00" };
const fullStub = {
  embarque: embarqueStub,
  conceptosVenta: [{ id: "cv-1" }],
  conceptosCosto: [],
  documentos: [],
  notas: [],
  facturas: [],
};

beforeEach(() => mockFetch.mockReset());

describe("useEmbarqueDetalleData", () => {
  it("retorna los datos derivados del embarque con tipos de cambio parseados", async () => {
    mockFetch.mockResolvedValue(fullStub);
    const { result } = renderHook(() => useEmbarqueDetalleData("e-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.embarque).toEqual(embarqueStub);
    expect(result.current.conceptosVenta).toEqual([{ id: "cv-1" }]);
    expect(result.current.tipoCambioUSD).toBe(17.5);
    expect(result.current.tipoCambioEUR).toBe(19);
  });

  it("retorna valores vacíos cuando no hay id", () => {
    const { result } = renderHook(() => useEmbarqueDetalleData(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.embarque).toBeNull();
    expect(result.current.conceptosVenta).toEqual([]);
    expect(result.current.tipoCambioUSD).toBe(1);
  });

  it("tipo de cambio cae a 1 si el valor es inválido", async () => {
    mockFetch.mockResolvedValue({
      ...fullStub,
      embarque: { ...embarqueStub, tipo_cambio_usd: null, tipo_cambio_eur: 0 },
    });
    const { result } = renderHook(() => useEmbarqueDetalleData("e-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tipoCambioUSD).toBe(1);
    expect(result.current.tipoCambioEUR).toBe(1);
  });
});
