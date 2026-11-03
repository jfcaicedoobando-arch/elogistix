import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import CxcAging from "@/features/cxc/routes/CxcAging";
import CxpAging from "@/features/cxp/routes/CxpAging";
import { BandejaPorFacturar } from "../BandejaPorFacturar";
import { BandejaProformasListas } from "../BandejaProformasListas";

const state = vi.hoisted(() => ({
  empty: false, loading: false, error: false, mobile: false,
  refetch: vi.fn(), setMoneda: vi.fn(),
}));
const agingRow = {
  cliente_id: "cliente-ficticio", proveedor_id: "proveedor-ficticio",
  cliente_nombre: "Cliente de prueba", proveedor_nombre: "Proveedor de prueba", moneda: "USD",
  saldo_total: 100, vigente: 100, d_1_30: 0, d_31_60: 0, d_61_90: 0, mas_90: 0, num_facturas: 1,
};
function queryState() {
  return { isLoading: state.loading, isError: state.error, error: state.error ? new Error("lectura fallida") : null, refetch: state.refetch };
}
function agingState() {
  return {
    ...queryState(), rowsFiltradas: state.empty ? [] : [agingRow], totales: { ...agingRow, total: 100 },
    monedas: ["MXN", "USD"], monedaActiva: "USD", setMoneda: state.setMoneda,
  };
}
vi.mock("@/features/cxc/hooks/useCxcAging", () => ({ useCxcAging: () => agingState() }));
vi.mock("@/features/cxp/hooks/useCxpAging", () => ({ useCxpAging: () => agingState() }));
vi.mock("@/features/cxc/components/CxcAgingDrillDownDialog", () => ({ CxcAgingDrillDownDialog: () => null }));
vi.mock("@/features/cxp/components/AgingDrillDownDialog", () => ({ AgingDrillDownDialog: () => null }));
vi.mock("@/lib/date/today", () => ({ todayLocalISO: () => "2026-11-02" }));
vi.mock("@/hooks/shared", () => ({ useIsMobile: () => state.mobile, useCargaExpirada: () => false }));
vi.mock("@/features/facturacion/hooks", () => ({
  useHuecoFacturacion: () => ({
    ...queryState(), totalEmbarques: state.empty ? 0 : 1, totalUsd: 100, totalMxn: 0, exportarCsv: vi.fn(),
    filas: state.empty ? [] : [{ embarque_id: "embarque-ficticio", expediente: "EXP-PRUEBA", cliente_nombre: "Cliente de prueba", operador: "", eta: "2026-11-02", diasDesdeEta: 0, ventaUsd: 100, ventaMxn: 0 }],
  }),
}));
vi.mock("@/features/facturacion/hooks/useProformasListas", () => ({
  useProformasListas: () => ({
    ...queryState(), data: state.empty ? [] : [{ id: "proforma-ficticia", numero: "PR-PRUEBA", cliente_nombre: "Cliente de prueba", expediente: "EXP-PRUEBA", total_usd: 100, total_mxn: 0, created_at: "2026-11-02" }],
  }),
}));

const cases = [
  { name: "CxC", Route: CxcAging, zero: "Sin saldos pendientes por cobrar en USD.", row: "Cliente de prueba", aging: true },
  { name: "CxP", Route: CxpAging, zero: "Sin saldos pendientes por pagar en USD.", row: "Proveedor de prueba", aging: true },
  { name: "Por facturar", Route: BandejaPorFacturar, zero: "Sin ventas pendientes de emisión en esta bandeja.", row: "Cliente de prueba", aging: false },
  { name: "Proformas listas", Route: BandejaProformasListas, zero: "Sin proformas listas para crear un borrador de factura.", row: "Cliente de prueba", aging: false },
];
const filtered = "No hay resultados con los filtros actuales.";
function wrapper(params = "") {
  const Nuqs = withNuqsTestingAdapter({ hasMemory: true, searchParams: params });
  return ({ children }: { children: ReactNode }) => <MemoryRouter><TooltipProvider><Nuqs>{children}</Nuqs></TooltipProvider></MemoryRouter>;
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, { empty: false, loading: false, error: false, mobile: false });
});

describe.each([false, true])("vacíos financieros, móvil=%s", (mobile) => {
  describe.each(cases)("$name", ({ Route, zero, row, aging }) => {
    beforeEach(() => { state.mobile = mobile; });

    it("una búsqueda sin coincidencias permite limpiar y recuperar las filas", async () => {
      render(<Route />, { wrapper: wrapper("?q=sin-coincidencias") });
      expect(screen.getByText(filtered)).toBeInTheDocument();
      expect(screen.queryByText(zero)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
      await waitFor(() => expect(screen.getByText(new RegExp(row, "i"))).toBeInTheDocument());
      expect(screen.getByRole("searchbox")).toHaveValue("");
      expect(screen.queryByText(filtered)).not.toBeInTheDocument();
    });

    it("cero real aclara el alcance y no ofrece limpiar filtros inexistentes", () => {
      state.empty = true;
      render(<Route />, { wrapper: wrapper() });
      expect(screen.getByText(zero)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
      expect(screen.queryByText(filtered)).not.toBeInTheDocument();
      if (aging) expect(screen.getByRole("button", { name: "USD", pressed: true })).toBeInTheDocument();
    });

    it("limpiar una búsqueda sobre un conjunto vacío revela el cero de ese alcance", async () => {
      state.empty = true;
      render(<Route />, { wrapper: wrapper("?q=sin-coincidencias") });
      expect(screen.getByText(filtered)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
      await waitFor(() => expect(screen.getByText(zero)).toBeInTheDocument());
      expect(screen.queryByText(filtered)).not.toBeInTheDocument();
      expect(screen.getByRole("searchbox")).toHaveValue("");
    });

    it("la carga no muestra afirmaciones de vacío", () => {
      Object.assign(state, { empty: true, loading: true });
      render(<Route />, { wrapper: wrapper("?q=sin-coincidencias") });
      expect(screen.queryByText(zero)).not.toBeInTheDocument();
      expect(screen.queryByText(filtered)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
    });

    it("el error ofrece reintentar y no se interpreta como cero, aun con filtros", () => {
      Object.assign(state, { empty: true, error: true });
      render(<Route />, { wrapper: wrapper("?q=sin-coincidencias") });
      expect(screen.queryByText(zero)).not.toBeInTheDocument();
      expect(screen.queryByText(filtered)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
      expect(state.refetch).toHaveBeenCalledOnce();
    });

    if (aging) it("limpia búsqueda y cubeta y conserva moneda y fecha para antigüedad", async () => {
      render(<Route />, { wrapper: wrapper("?q=sin-coincidencias&cubeta=mas_90") });
      const fecha = screen.getByRole("textbox", { name: "Fecha para antigüedad" });
      fireEvent.change(fecha, { target: { value: "15/10/2026" } });
      fireEvent.blur(fecha);
      expect(fecha).toHaveValue("15/10/2026");
      expect(screen.getByText(/Se conserva la fecha para antigüedad/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
      await waitFor(() => expect(screen.getByText(new RegExp(row, "i"))).toBeInTheDocument());
      expect(screen.getByRole("searchbox")).toHaveValue("");
      expect(screen.queryByText(/Con saldo en: mas_90/)).not.toBeInTheDocument();
      expect(fecha).toHaveValue("15/10/2026");
      expect(screen.getByRole("button", { name: "USD", pressed: true })).toBeInTheDocument();
      expect(state.setMoneda).not.toHaveBeenCalled();
    });
  });
});
