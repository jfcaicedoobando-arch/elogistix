import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { useAbrirRefacturacion } from "../useAbrirRefacturacion";
import type { Tables } from "@/types/db";

type Concepto = Tables<"conceptos_venta">;
const c = (id: string) => ({ id }) as unknown as Concepto; // SAFE-CAST: sólo se usa el id.

const state = { refacturacion: { conceptoIds: ["a", "b"], notas: "[Refacturación de proforma PRO-1 / Factura F1 cancelada]", anteriorNumero: "PRO-1" } };
const wrapper = (s: unknown) => ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={[{ pathname: "/embarques/e1", search: "?tab=facturacion", state: s }]}>{children}</MemoryRouter>
);

describe("useAbrirRefacturacion", () => {
  it("abre Generar proforma con la nota de linaje cuando todos los conceptos liberados son elegibles", () => {
    const abrir = vi.fn();
    renderHook(() => useAbrirRefacturacion({ canEdit: true, conceptosElegibles: [c("a"), c("b")], abrir }), { wrapper: wrapper(state) });
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveBeenCalledWith("[Refacturación de proforma PRO-1 / Factura F1 cancelada]");
  });

  it("espera mientras falte algún concepto liberado", () => {
    const abrir = vi.fn();
    renderHook(() => useAbrirRefacturacion({ canEdit: true, conceptosElegibles: [c("a")], abrir }), { wrapper: wrapper(state) });
    expect(abrir).not.toHaveBeenCalled();
  });

  it("no abre sin permiso de edición", () => {
    const abrir = vi.fn();
    renderHook(() => useAbrirRefacturacion({ canEdit: false, conceptosElegibles: [c("a"), c("b")], abrir }), { wrapper: wrapper(state) });
    expect(abrir).not.toHaveBeenCalled();
  });

  it("no abre al entrar al embarque sin venir de refacturación", () => {
    const abrir = vi.fn();
    renderHook(() => useAbrirRefacturacion({ canEdit: true, conceptosElegibles: [c("a")], abrir }), { wrapper: wrapper(null) });
    expect(abrir).not.toHaveBeenCalled();
  });
});
