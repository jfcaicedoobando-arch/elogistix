import { act, cleanup, renderHook } from "@testing-library/react";
import { useLayoutEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCarteraPdfExport } from "../useCarteraPdfExport";
import { descargarCarteraPdf } from "../../services/carteraDescargas";

vi.mock("../../services/carteraDescargas", () => ({ descargarCarteraPdf: vi.fn() }));
const download = vi.mocked(descargarCarteraPdf);
const selection = { fechaCorte: "2026-10-13", leyenda: "TC", bloques: [], dataScope: { userId: "u", organizationId: "a", role: "admin", generation: 1 }, puedeExportar: true, busqueda: "" };
function deferred() { let resolve!: () => void; const promise = new Promise<void>(yes => { resolve = yes; }); return { promise, resolve }; }
const options = (index = 0) => download.mock.calls[index][4]!;
beforeEach(() => { vi.resetAllMocks(); });
afterEach(cleanup);

describe("Cartera PDF job ownership", () => {
  it("admits only one same-tick start using the synchronous job ref", async () => {
    const pending = deferred();
    download.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useCarteraPdfExport(selection));
    let first!: Promise<void>;
    await act(async () => { first = result.current.exportarPdf(); void result.current.exportarPdf(); });
    expect(download).toHaveBeenCalledOnce();
    expect(options().signal?.aborted).toBe(false);
    expect(options().sigueVigente?.()).toBe(true);
    await act(async () => { pending.resolve(); await first; });
    expect(result.current.generandoPdf).toBe(false);
    expect(options().sigueVigente?.()).toBe(false);
  });

  it("aborts and invalidates synchronously during unmount without waiting for the renderer", async () => {
    const pending = deferred();
    download.mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useCarteraPdfExport(selection));
    let promise!: Promise<void>;
    act(() => { promise = result.current.exportarPdf(); });
    unmount();
    expect(options().signal?.aborted).toBe(true);
    expect(options().sigueVigente?.()).toBe(false);
    pending.resolve(); await promise;
  });

  it("StrictMode cleanup invalidates a started job permanently while setup permits a new one", async () => {
    const old = deferred();
    const current = deferred();
    download.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const { result } = renderHook(() => {
      const exporter = useCarteraPdfExport(selection);
      const start = useRef(exporter.exportarPdf);
      useLayoutEffect(() => { void start.current(); }, []);
      return exporter;
    }, { reactStrictMode: true });
    expect(download).toHaveBeenCalledTimes(2);
    expect(options(0).signal?.aborted).toBe(true);
    expect(options(0).sigueVigente?.()).toBe(false);
    expect(options(1).signal?.aborted).toBe(false);
    expect(options(1).sigueVigente?.()).toBe(true);
    await act(async () => { old.resolve(); await old.promise; });
    expect(result.current.generandoPdf).toBe(true);
    await act(async () => { current.resolve(); await current.promise; });
    expect(result.current.generandoPdf).toBe(false);
  });

  it("an old finally cannot release a replacement job after scope change", async () => {
    const old = deferred(); const current = deferred();
    download.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const { result, rerender } = renderHook(props => useCarteraPdfExport(props), { initialProps: selection });
    let first!: Promise<void>; let second!: Promise<void>;
    act(() => { first = result.current.exportarPdf(); });
    rerender({ ...selection, dataScope: { ...selection.dataScope, generation: 2 } });
    expect(options(0).signal?.aborted).toBe(true);
    act(() => { second = result.current.exportarPdf(); });
    await act(async () => { old.resolve(); await first; });
    expect(result.current.generandoPdf).toBe(true);
    expect(options(1).sigueVigente?.()).toBe(true);
    await act(async () => { current.resolve(); await second; });
    expect(result.current.generandoPdf).toBe(false);
  });
});
