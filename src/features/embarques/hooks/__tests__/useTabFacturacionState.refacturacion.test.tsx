import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Tables } from "@/types/db";
import { useTabFacturacionState } from "../useTabFacturacionState";

vi.mock("@/features/catalogos/hooks", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("@/features/embarques/hooks", () => ({
  useEmbarqueConceptosVenta: () => ({ data: ["c1", "c2"].map((id) => ({ id, estado_facturacion: "pendiente", proforma_id: null })) }),
  useContenedoresEmbarque: () => ({ data: [] }),
  useProformasEmbarque: () => ({ data: [] }),
  useEliminarProforma: () => ({ mutateAsync: vi.fn() }),
  useDescargarProformaPdf: () => ({ descargar: vi.fn() }),
}));
vi.mock("../useFocusSection", () => ({ useFocusSection: () => ({ registerRef: vi.fn() }) }));
const refacturacion = { embarque_id: "e1", conceptos: ["c1"], notas_sugeridas: "Linaje", anterior_numero: "P1", factura_cancelada: "F1" };
const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[
  { pathname: "/embarques/e1", search: "?tab=facturacion", state: { refacturacion } },
]}>{children}</MemoryRouter>;
const row = (estado: string) => ({ id: "e1", estado }) as Tables<"embarques">;

describe("tab facturación y apertura real de refacturación", () => {
  it.each([["Cerrado", true], ["Borrador", true], ["En Tránsito", false]] as const)(
    "no abre en %s / permiso %s", (estado, permiso) => {
      const { result } = renderHook(() => useTabFacturacionState(row(estado), permiso), { wrapper });
      expect(result.current.canEdit).toBe(false);
      expect(result.current.dialogOpen).toBe(false);
      expect(result.current.dialogRefacturacion).toBeNull();
    },
  );
  it("abre con linaje y cerrar no reabre; generación normal siguiente limpia la precarga", () => {
    const { result, rerender } = renderHook(() => useTabFacturacionState(row("En Tránsito"), true), { wrapper });
    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.dialogRefacturacion).toEqual(refacturacion);
    act(() => result.current.setDialogOpen(false));
    rerender();
    expect(result.current.dialogOpen).toBe(false);
    act(() => result.current.abrirGenerarProforma());
    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.dialogRefacturacion).toBeNull();
  });
});
