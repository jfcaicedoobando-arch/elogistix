import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pdf: vi.fn(), csv: vi.fn(), cliente: vi.fn(), warning: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock("@/generators/estadoCuentaPdf", () => ({ generarEstadoCuentaPdf: mocks.pdf }));
vi.mock("@/generators/exportCsv", () => ({ exportToCsv: mocks.csv }));
vi.mock("../../services/clienteFicha", () => ({ fetchClienteFichaEstadoCuenta: mocks.cliente }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: mocks.warning, notifySuccess: mocks.success, notifyError: mocks.error }));

import { useExportActions } from "../useExportActions";
import type { FacturaEstadoCuenta } from "../../services/estadoCuenta";

const CLIENTE = { id: "cliente", nombre: "Prueba", rfc: null };
const ROW: FacturaEstadoCuenta = {
  id: "a3", numero: "A3", cliente_id: "cliente", cliente_nombre: "Prueba", expediente: "E3",
  moneda: "MXN", total: 116, pagado: 0, notas_credito_aplicadas: 58, saldo: 58,
  fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-10", dias_vencido: 0,
  estatus_cobranza: "Por vencer", estado_factura: "Emitida", pagos: [], notas_credito: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cliente.mockResolvedValue(CLIENTE);
  mocks.pdf.mockResolvedValue(undefined);
});

describe("exportación del mismo corte de estado de cuenta", () => {
  it("envía al PDF y CSV los saldos de las filas filtradas", async () => {
    const { result } = renderHook(() => useExportActions(["cliente"], [ROW]));
    await act(async () => { await result.current.onPdf(); });
    act(() => { result.current.onCsv(); });
    expect(mocks.pdf).toHaveBeenCalledWith(CLIENTE, [expect.objectContaining({ numero: "A3", total: 116, saldo: 58 })]);
    expect(mocks.csv).toHaveBeenCalledWith(expect.any(String), expect.any(Array), [expect.objectContaining({ numero: "A3", total: 116, saldo: 58 })]);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("usa un saldo actualizado aunque no cambie el número de filas", async () => {
    const ids = ["cliente"];
    const { result, rerender } = renderHook(({ rows }) => useExportActions(ids, rows), { initialProps: { rows: [ROW] } });
    rerender({ rows: [{ ...ROW, pagado: 20, saldo: 38 }] });
    await act(async () => { await result.current.onPdf(); });
    expect(mocks.pdf).toHaveBeenCalledWith(CLIENTE, [expect.objectContaining({ numero: "A3", saldo: 38 })]);
  });

  it("no exporta facturas fuera de un corte vacío", async () => {
    const { result } = renderHook(() => useExportActions(["cliente"], []));
    await act(async () => { await result.current.onPdf(); });
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(mocks.cliente).not.toHaveBeenCalled();
    expect(mocks.warning).toHaveBeenCalledOnce();
  });
});
