/**
 * Lote P2 (item 4): un fallo de importación bancaria debe avisar UNA sola vez.
 * Antes el hook de mutación mostraba su toast (`errorTitle`) y además
 * `useImportarEstadoCuenta` llamaba a `notifyError` en el catch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ChangeEvent } from "react";

const notifyError = vi.fn();
const notifyInfo = vi.fn();
const notifySuccess = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...a: unknown[]) => notifyError(...a),
  notifyInfo: (...a: unknown[]) => notifyInfo(...a),
  notifySuccess: (...a: unknown[]) => notifySuccess(...a),
}));

vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: vi.fn() }));

const parse = vi.fn();
vi.mock("@/features/tesoreria/domain/import/bbva", () => ({
  parseEstadoCuentaBBVA: (...a: unknown[]) => parse(...a),
}));

const mutateAsync = vi.fn();
vi.mock("@/features/tesoreria/hooks", () => ({
  useImportarMovimientos: () => ({ mutateAsync, isPending: false }),
}));

import { useImportarEstadoCuenta } from "../useImportarEstadoCuenta";

const evento = { target: { files: [new File(["x"], "bbva.xlsx")] } } as unknown as ChangeEvent<HTMLInputElement>;

beforeEach(() => {
  notifyError.mockClear();
  notifySuccess.mockClear();
  parse.mockResolvedValue({
    movimientos: [{ hash_dedupe: "h1" }],
    ilegibles: [],
    sinImporte: 0,
  });
});

describe("useImportarEstadoCuenta", () => {
  it("un fallo de importación notifica una sola vez, con el detalle", async () => {
    mutateAsync.mockRejectedValueOnce(
      new Error("Importación incompleta: se guardaron 500 movimientos y faltaron 1."),
    );
    const { result } = renderHook(() => useImportarEstadoCuenta("cta-1"));
    await act(async () => { await result.current.handleFile(evento); });

    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(notifyError.mock.calls[0][1]).toMatchObject({
      title: expect.stringContaining("se guardaron 500 movimientos"),
    });
  });

  it("la ruta feliz notifica un solo éxito", async () => {
    mutateAsync.mockResolvedValueOnce({ nuevos: 1, duplicados: 0 });
    const { result } = renderHook(() => useImportarEstadoCuenta("cta-1"));
    await act(async () => { await result.current.handleFile(evento); });

    expect(notifyError).not.toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledTimes(1);
  });
});
