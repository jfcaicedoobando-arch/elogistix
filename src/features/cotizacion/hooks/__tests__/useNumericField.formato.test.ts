import { describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

import { useNumericField } from "../useNumericField";

/**
 * v13.823.286 — los campos de dinero del wizard se leen con formato al perder
 * el foco (`6100` → `6,100.00`) pero se editan en plano: si el formato se
 * filtrara al tener foco, el usuario pelearía con las comas al teclear.
 */
describe("useNumericField · formato de presentación", () => {
  const formato = (n: number) => n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  it("muestra el valor formateado sin foco", () => {
    const { result } = renderHook(() => useNumericField(6100, vi.fn(), { formatDisplay: formato }));
    expect(result.current.value).toBe("6,100.00");
  });

  it("muestra el número plano al enfocar y confirma el valor en blur", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useNumericField(6100, commit, { formatDisplay: formato }));

    act(() => result.current.onFocus());
    expect(result.current.value).toBe("6100");

    act(() => result.current.onChange({ target: { value: "6,650" } } as React.ChangeEvent<HTMLInputElement>));
    act(() => result.current.onBlur());
    expect(commit).toHaveBeenCalledWith(6650);
  });

  it("deja el campo vacío cuando el valor es cero", () => {
    const { result } = renderHook(() => useNumericField(0, vi.fn(), { formatDisplay: formato }));
    expect(result.current.value).toBe("");
  });
});
