import { StrictMode, useState, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { useAbrirRefacturacion } from "../useAbrirRefacturacion";

const refacturacion = {
  embarque_id: "e1", conceptos: ["a", "b"], notas_sugeridas: "Linaje P1 / F1",
  anterior_numero: "P1", factura_cancelada: "F1",
};
const wrapper = (state: unknown = { refacturacion }) => ({ children }: { children: ReactNode }) => (
  <StrictMode><MemoryRouter initialEntries={[{ pathname: "/embarques/e1", search: "?tab=facturacion", state }]}>
    {children}
  </MemoryRouter></StrictMode>
);

describe("entrada de refacturación recuperada", () => {
  it("abre una sola vez cuando están disponibles los conceptos, consume navegación y respeta cerrar", () => {
    const abrir = vi.fn();
    const { result, rerender } = renderHook(({ ids }) => {
      const [open, setOpen] = useState(false);
      useAbrirRefacturacion({ embarqueId: "e1", canEdit: true,
        conceptosElegibles: ids.map((id) => ({ id })), abrir: (r) => { abrir(r); setOpen(true); } });
      return { open, close: () => setOpen(false), location: useLocation(), navigate: useNavigate() };
    }, { wrapper: wrapper(), initialProps: { ids: ["a"] } });
    expect(abrir).not.toHaveBeenCalled();
    rerender({ ids: ["a", "b", "otro"] });
    expect(abrir).toHaveBeenCalledExactlyOnceWith(refacturacion);
    expect(result.current.open).toBe(true);
    expect(result.current.location.state).toBeNull();
    act(() => result.current.close());
    rerender({ ids: ["a", "b"] });
    expect(result.current.open).toBe(false);
    expect(abrir).toHaveBeenCalledOnce();
    act(() => result.current.navigate("/embarques/otro"));
    act(() => result.current.navigate(-1));
    expect(result.current.location.pathname).toBe("/embarques/e1");
    expect(abrir).toHaveBeenCalledOnce();
  });
  it.each([
    [false, "e1", { refacturacion }],
    [true, "otro", { refacturacion }],
    [true, "e1", null],
    [true, "e1", { refacturacion: { conceptos: ["a"] } }],
  ])("no abre sin permiso, en otro embarque o con estado inválido (%s/%s)", (canEdit, embarqueId, state) => {
    const abrir = vi.fn();
    renderHook(() => useAbrirRefacturacion({ canEdit, embarqueId,
      conceptosElegibles: [{ id: "a" }, { id: "b" }], abrir }), { wrapper: wrapper(state) });
    expect(abrir).not.toHaveBeenCalled();
  });
});
