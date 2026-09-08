/**
 * Ola 8 (M8): los filtros de listados deben vivir en el query string.
 *
 * Se usa `withNuqsTestingAdapter` (docs oficiales nuqs) en lugar de un router
 * real: deshabilita el rate limiting y expone `onUrlUpdate`, así cada test
 * espera a que la URL termine de escribirse antes del teardown.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { useFiltroUrl, useTextoUrl } from "../useFiltroUrl";

const MONEDAS = ["todas", "MXN", "USD"] as const;
type Moneda = (typeof MONEDAS)[number];

function makeWrapper(onUrlUpdate: OnUrlUpdateFunction) {
  return withNuqsTestingAdapter({ onUrlUpdate, hasMemory: true });
}

describe("useFiltroUrl / useTextoUrl", () => {
  it("arranca en el valor por defecto", () => {
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(
      () => useFiltroUrl<Moneda>("moneda", MONEDAS, "todas"),
      { wrapper: makeWrapper(onUrlUpdate) },
    );
    expect(result.current[0]).toBe("todas");
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it("actualiza el valor del filtro", async () => {
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(
      () => useFiltroUrl<Moneda>("moneda2", MONEDAS, "todas"),
      { wrapper: makeWrapper(onUrlUpdate) },
    );
    await act(async () => { result.current[1]("MXN"); });
    expect(result.current[0]).toBe("MXN");
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
      const last = onUrlUpdate.mock.calls.at(-1)?.[0];
      expect(last.searchParams.get("moneda2")).toBe("MXN");
    });
  });

  it("regresar al valor por defecto limpia el parámetro", async () => {
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(
      () => useFiltroUrl<Moneda>("moneda3", MONEDAS, "todas"),
      { wrapper: makeWrapper(onUrlUpdate) },
    );
    await act(async () => { result.current[1]("USD"); });
    expect(result.current[0]).toBe("USD");
    await waitFor(() => {
      const last = onUrlUpdate.mock.calls.at(-1)?.[0];
      expect(last?.searchParams.get("moneda3")).toBe("USD");
    });

    await act(async () => { result.current[1]("todas"); });
    expect(result.current[0]).toBe("todas");
    await waitFor(() => {
      const last = onUrlUpdate.mock.calls.at(-1)?.[0];
      expect(last?.searchParams.get("moneda3")).toBeNull();
    });
  });

  it("maneja texto libre y lo limpia al vaciarlo", async () => {
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(() => useTextoUrl("q"), {
      wrapper: makeWrapper(onUrlUpdate),
    });
    expect(result.current[0]).toBe("");

    await act(async () => { result.current[1]("ACME"); });
    expect(result.current[0]).toBe("ACME");
    await waitFor(() => {
      const last = onUrlUpdate.mock.calls.at(-1)?.[0];
      expect(last?.searchParams.get("q")).toBe("ACME");
    });

    await act(async () => { result.current[1](""); });
    expect(result.current[0]).toBe("");
    await waitFor(() => {
      const last = onUrlUpdate.mock.calls.at(-1)?.[0];
      expect(last?.searchParams.get("q")).toBeNull();
    });
  });
});
