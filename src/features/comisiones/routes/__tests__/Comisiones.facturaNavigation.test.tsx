import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ComisionDevengada } from "@/features/comisiones/services";
import Comisiones from "../Comisiones";

const { rows } = vi.hoisted(() => ({ rows: [] as ComisionDevengada[] }));
vi.mock("@/features/comisiones/hooks", () => ({
  useUsuariosVendedores: () => ({ data: [] }),
  useComisionesDevengadas: () => ({
    data: rows, isLoading: false, isError: false, refetch: vi.fn(),
    kpis: undefined, kpisLoading: false, kpisError: null, refetchKpis: vi.fn(),
  }),
}));
vi.mock("@/features/comisiones/hooks/useVendedorasEmailWarning", () => ({ useVendedorasEmailWarning: vi.fn() }));
vi.mock("@/features/comisiones/components/AlertaComisionesPendientes", () => ({ AlertaComisionesPendientes: () => null }));
vi.mock("@/features/comisiones/components/ComisionesKpis", () => ({ ComisionesKpis: () => null }));
vi.mock("@/features/comisiones/components/TabLiquidaciones", () => ({ TabLiquidaciones: () => null }));
vi.mock("@/features/comisiones/components/TabVendedorasConfig", () => ({ TabVendedorasConfig: () => null }));

function mostrar() {
  const base: ComisionDevengada = {
    id: "c1", organization_id: "org", pago_factura_id: "p1", embarque_id: null, factura_id: "f2",
    vendedora_id: null, vendedora_nombre: null, factura_numero: "A2", cliente_nombre: "Aceros", expediente: null,
    monto_cobrado_mxn: 116, utilidad_prorrateada_mxn: 0, porcentaje_aplicado: 0, comision_mxn: 0,
    estado: "Devengada", liquidacion_id: null, nota: "Sin embarque asociado", created_at: "2026-10-03T12:00:00Z",
  };
  rows.splice(0, rows.length, base, { ...base, id: "c2", pago_factura_id: "p2" }, {
    ...base, id: "c3", factura_id: "f3", factura_numero: "A3",
  });
  return render(
    <NuqsTestingAdapter searchParams="?q=A2" hasMemory>
      <MemoryRouter initialEntries={["/comisiones?q=A2"]}>
        <Routes>
          <Route path="/comisiones" element={<Comisiones />} />
          <Route path="/facturacion/f2" element={<p>Detalle factura A2</p>} />
        </Routes>
      </MemoryRouter>
    </NuqsTestingAdapter>,
  );
}

describe("82: factura identificable y navegable en Comisiones", () => {
  it("muestra los dos cobros de A2 con encabezado y folio sin clases que los oculten", () => {
    mostrar();
    const header = screen.getByRole("columnheader", { name: "Factura" });
    expect(header.className).not.toMatch(/\bhidden\b/);
    expect(screen.queryByText("A3")).not.toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Abrir factura A2" });
    expect(links).toHaveLength(2);
    for (const link of links) {
      const invoice = within(link).getByText("A2").closest("td")!;
      expect(invoice.className).not.toMatch(/\bhidden\b/);
      expect(within(link).getByText("MXN 116.00")).toBeVisible();
      expect(within(link).getAllByText("No calculada")).toHaveLength(2);
      expect(within(link).getAllByText("Sin embarque asociado").length).toBeGreaterThan(0);
    }
  });

  it.each(["click", "keyboard"])("abre la factura desde el cobro por %s", (interaction) => {
    mostrar();
    const link = screen.getAllByRole("link", { name: "Abrir factura A2" })[0];
    if (interaction === "click") fireEvent.click(link);
    else fireEvent.keyDown(link, { key: "Enter" });
    expect(screen.getByText("Detalle factura A2")).toBeVisible();
  });
});
