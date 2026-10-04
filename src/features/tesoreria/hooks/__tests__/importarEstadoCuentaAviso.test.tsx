import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ChangeEvent } from "react";
import { clasificarRevisionImportacion } from "../../domain/import/revisionImportacion";
import type { RevisionImportacion } from "../../services/revisionImportacion";

const feedback = vi.hoisted(() => ({ notifyError: vi.fn(), notifyInfo: vi.fn(), notifySuccess: vi.fn(), notifyWarning: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => feedback);
vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const mocks = vi.hoisted(() => ({ parse: vi.fn(), revisar: vi.fn(), mutateAsync: vi.fn() }));
vi.mock("@/features/tesoreria/domain/import/bbva", () => ({ parseEstadoCuentaBBVA: mocks.parse }));
vi.mock("@/features/tesoreria/services/revisionImportacion", () => ({ revisarImportacion: mocks.revisar }));
vi.mock("@/features/tesoreria/hooks", () => ({ useImportarMovimientos: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }) }));
import { useImportarEstadoCuenta } from "../useImportarEstadoCuenta";
import { ImportacionParcialError } from "../../services/conciliacionImportar";

const fila = { fecha: "2026-10-03", concepto: "Depósito", referencia: "R", cargo: 0, abono: 25, saldo: 100, hash_dedupe: "h1" };
const lectura = (): RevisionImportacion => ({ cuenta: { id: "cta-1", alias: "Operativa", banco: "Banorte", moneda: "MXN" }, resumen: clasificarRevisionImportacion([fila], new Set(), []) });
function evento(): ChangeEvent<HTMLInputElement> {
  const input = document.createElement("input");
  Object.defineProperty(input, "files", { value: [new File(["x"], "bbva.xlsx")] });
  return { target: input } as ChangeEvent<HTMLInputElement>;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.parse.mockResolvedValue({ movimientos: [fila], ilegibles: [], sinImporte: 0 });
  mocks.revisar.mockResolvedValue(lectura());
  mocks.mutateAsync.mockResolvedValue({ nuevos: 1, duplicados: 0 });
});

describe("Importación: revisar antes de persistir", () => {
  it("seleccionar y cancelar no guarda nada", async () => {
    const { result } = renderHook(() => useImportarEstadoCuenta("cta-1"));
    await act(async () => { await result.current.handleFile(evento()); });
    expect(result.current.revision?.resumen.abonos).toBe(25);
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    act(() => result.current.cancelarRevision());
    expect(result.current.revision).toBeNull();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });
  it("un fallo confirmado notifica una sola vez y permite reintentar", async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error("Importación incompleta: se guardaron 500 movimientos y faltaron 1."));
    const { result } = renderHook(() => useImportarEstadoCuenta("cta-1"));
    await act(async () => { await result.current.handleFile(evento()); });
    await act(async () => { await result.current.confirmarRevision(); });
    expect(feedback.notifyError).toHaveBeenCalledTimes(1);
    expect(feedback.notifyError.mock.calls[0][1].title).toContain("se guardaron 500 movimientos");
    expect(result.current.revision).not.toBeNull();
  });
  it("el aviso de fallo parcial informa el vínculo que ya quedó confirmado", async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new ImportacionParcialError(0, 1, { message: "falló insert" }, 1));
    const { result } = renderHook(() => useImportarEstadoCuenta("cta-1"));
    await act(async () => { await result.current.handleFile(evento()); });
    await act(async () => { await result.current.confirmarRevision(); });
    expect(feedback.notifyError).toHaveBeenCalledTimes(1);
    expect(feedback.notifyError.mock.calls[0][1].title).toContain("se vincularon 1 movimientos internos");
    expect(feedback.notifyError.mock.calls[0][1].title).toContain("1 nuevos pendientes");
  });
  it("confirmar revalida y guarda una sola vez aunque se pulse dos veces", async () => {
    const { result } = renderHook(() => useImportarEstadoCuenta("cta-1"));
    await act(async () => { await result.current.handleFile(evento()); });
    await act(async () => { await Promise.all([result.current.confirmarRevision(), result.current.confirmarRevision()]); });
    expect(mocks.revisar).toHaveBeenCalledTimes(2);
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ cuentaId: "cta-1", revision: [expect.objectContaining({ espejo: null })] }));
    expect(feedback.notifySuccess).toHaveBeenCalledTimes(1);
    expect(result.current.revision).toBeNull();
  });
  it("si aparece un cobro nuevo actualiza la revisión sin guardar", async () => {
    const { result } = renderHook(() => useImportarEstadoCuenta("cta-1"));
    await act(async () => { await result.current.handleFile(evento()); });
    mocks.revisar.mockResolvedValueOnce({ ...lectura(), resumen: clasificarRevisionImportacion([fila], new Set(), [{ id: "e1", cuenta_bancaria_id: "cta-1", pago_factura_id: "p1", fecha: fila.fecha, cargo: 0, abono: 25, hash_dedupe: "cobro-p1" }]) });
    await act(async () => { await result.current.confirmarRevision(); });
    expect(result.current.revision?.resumen.vinculables).toBe(1);
    expect(feedback.notifyWarning).toHaveBeenCalledTimes(1);
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });
  it("cambiar de cuenta durante la revalidación cancela la confirmación anterior", async () => {
    const { result, rerender } = renderHook(({ cuenta }) => useImportarEstadoCuenta(cuenta), { initialProps: { cuenta: "cta-1" } });
    await act(async () => { await result.current.handleFile(evento()); });
    let resolver!: (r: RevisionImportacion) => void;
    mocks.revisar.mockReturnValueOnce(new Promise<RevisionImportacion>((resolve) => { resolver = resolve; }));
    let confirmar!: Promise<void>;
    act(() => { confirmar = result.current.confirmarRevision(); });
    rerender({ cuenta: "cta-2" });
    await act(async () => { resolver(lectura()); await confirmar; });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(result.current.revision).toBeNull();
  });
  it("una lectura incompleta bloquea toda la revisión", async () => {
    mocks.parse.mockResolvedValueOnce({ movimientos: [fila], ilegibles: [{ fila: 4, motivo: "fecha ilegible" }], sinImporte: 0 });
    const { result } = renderHook(() => useImportarEstadoCuenta("cta-1"));
    await act(async () => { await result.current.handleFile(evento()); });
    expect(mocks.revisar).not.toHaveBeenCalled();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(feedback.notifyError.mock.calls[0][1].title).toContain("fila 4");
  });
});
