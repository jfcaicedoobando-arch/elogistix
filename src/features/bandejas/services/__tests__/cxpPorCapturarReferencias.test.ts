import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCxpPorCapturar, type CxpPorCapturarRow } from "../bandejas";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), select: vi.fn(), in: vi.fn(), is: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
const row: CxpPorCapturarRow = {
  embarque_id: "draft-1", expediente: null, cliente_nombre: "Aceros", presupuestado_mxn: 62000,
  presupuestado_usd: 0, facturado_mxn: 0, facturado_usd: 0, facturas_capturadas: 0,
  ultima_factura_fecha: null, dias_desde_ultima_factura: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: [row], error: null });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ in: mocks.in });
  mocks.in.mockReturnValue({ is: mocks.is });
});

describe("fetchCxpPorCapturar — referencias por lote", () => {
  it("une estado y cotización sin cambiar presupuestos ni captura", async () => {
    mocks.is.mockResolvedValue({ data: [{ id: "draft-1", expediente: null, estado: "Borrador", cotizacion: { folio: "COT-2026-0025", deleted_at: null } }], error: null });
    expect(await fetchCxpPorCapturar()).toEqual([{ ...row, estado_embarque: "Borrador", cotizacion_folio: "COT-2026-0025" }]);
    expect(mocks.from).toHaveBeenCalledWith("embarques");
    expect(mocks.in).toHaveBeenCalledWith("id", ["draft-1"]);
    expect(mocks.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("no muestra cotizaciones eliminadas ni etiqueta como borrador una operación confirmada", async () => {
    mocks.is.mockResolvedValue({ data: [{ id: "draft-1", expediente: "ELNAC00014", estado: "Confirmado", cotizacion: { folio: "COT-ELIMINADA", deleted_at: "2026-10-01" } }], error: null });
    expect(await fetchCxpPorCapturar()).toEqual([{ ...row, expediente: "ELNAC00014", estado_embarque: "Confirmado", cotizacion_folio: null }]);
  });

  it("propaga fallo de metadata y evita consultas cuando no hay filas", async () => {
    const error = { message: "No se pudo leer referencias" };
    mocks.is.mockResolvedValue({ data: null, error });
    await expect(fetchCxpPorCapturar()).rejects.toBe(error);
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    mocks.from.mockClear();
    expect(await fetchCxpPorCapturar()).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("parte las referencias en lotes sin perder filas cerca del tope de la bandeja", async () => {
    const rows = Array.from({ length: 499 }, (_, i) => ({ ...row, embarque_id: `draft-${i}` }));
    mocks.rpc.mockResolvedValue({ data: rows, error: null });
    mocks.is.mockResolvedValue({ data: [], error: null });
    const result = await fetchCxpPorCapturar();
    expect(result).toHaveLength(499);
    expect(mocks.in.mock.calls.map(([, ids]) => ids.length)).toEqual([200, 200, 99]);
    expect(result[498]).toMatchObject({ ...rows[498], estado_embarque: null, cotizacion_folio: null });
  });

  it("conserva el guard de truncamiento de la RPC antes de enriquecer referencias", async () => {
    mocks.rpc.mockResolvedValue({ data: Array.from({ length: 500 }, () => row), error: null });
    await expect(fetchCxpPorCapturar()).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
