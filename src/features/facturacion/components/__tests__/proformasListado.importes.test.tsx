import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DataTable } from "@/components/shared/DataTable";
import { buildProformasColumns } from "../proformasColumns";
import { ProformaMobileCard } from "../ProformaMobileCard";
import { proformaFixture } from "./fixtures/proforma";
import { calcularTotalesProforma } from "@/features/proformas/domain";

const totals = calcularTotalesProforma([
  { id: "c1", cantidad: 1, precio_unitario: 1533.33, moneda: "MXN", aplica_iva: true },
  { id: "c2", cantidad: 1, precio_unitario: 1533.33, moneda: "MXN", aplica_iva: true },
], 0.16);

function listedRows() {
  return [
    proformaFixture({ id: "alto", numero: "PRO-ALTO", total_mxn: 9.99, total_usd: 0 }),
    proformaFixture({ id: "audit38", numero: "PRO-AUDIT38", total_mxn: 3557.3256, totales_calculados: totals }),
    proformaFixture({ id: "usd", numero: "PRO-USD", total_mxn: 0, total_usd: 10000 }),
  ];
}

describe("Listado de proformas con contexto financiero", () => {
  it("sin snapshot la tarjeta conserva el importe histórico y avisa que falta el detalle", () => {
    render(<ProformaMobileCard proforma={proformaFixture({ total_mxn: 116, total_usd: 58, totales_origen: "encabezado_sin_detalle" })} />);
    expect(screen.getByText(/MXN.*116.00/)).toBeInTheDocument();
    expect(screen.getByText(/USD.*58.00/)).toBeInTheDocument();
    expect(screen.getByText(/Importe guardado.*Detalle de conceptos no disponible/)).toBeInTheDocument();
  });

  it("expone expediente, fecha y cifras por moneda sin ocultarlas bajo xl", () => {
    render(<MemoryRouter><DataTable columns={buildProformasColumns({})} data={listedRows()} rowKey={(p) => p.id} /></MemoryRouter>);
    for (const label of ["Expediente", "Fecha", "Total MXN", "Total USD"]) {
      const header = screen.getByRole("columnheader", { name: label });
      expect(header.className).not.toMatch(/hidden|xl:table-cell/);
    }
    const row = screen.getByText("PRO-AUDIT38").closest("tr");
    expect(row).not.toBeNull();
    expect(within(row!).getByText("3,557.32")).toBeInTheDocument();
    expect(within(row!).getByRole("link", { name: "EXP-1" })).toHaveAttribute("href", "/embarques/e1");
    expect(within(row!).getByText("05/01/2024")).toBeInTheDocument();
  });

  it("ordena numéricamente cada moneda sin convertir ni sumar MXN y USD", () => {
    render(<MemoryRouter><DataTable columns={buildProformasColumns({})} data={listedRows()} rowKey={(p) => p.id} /></MemoryRouter>);
    const order = () => screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent);
    fireEvent.click(screen.getByRole("columnheader", { name: "Total MXN" }));
    expect(order()).toEqual(["PRO-AUDIT38", "PRO-ALTO", "PRO-USD"]);
    fireEvent.click(screen.getByRole("columnheader", { name: "Total MXN" }));
    expect(order()).toEqual(["PRO-USD", "PRO-ALTO", "PRO-AUDIT38"]);
    fireEvent.click(screen.getByRole("columnheader", { name: "Total USD" }));
    expect(order()).toEqual(["PRO-USD", "PRO-ALTO", "PRO-AUDIT38"]);
    fireEvent.click(screen.getByRole("columnheader", { name: "Total USD" }));
    expect(order()).toEqual(["PRO-ALTO", "PRO-AUDIT38", "PRO-USD"]);
  });

  it("la tarjeta móvil conserva importes, expediente y fecha con el cálculo de la GUI", () => {
    render(<ProformaMobileCard proforma={listedRows()[1]} />);
    expect(screen.getByText(/EXP-1.*05\/01\/2024/)).toBeInTheDocument();
    expect(screen.getByText(/MXN.*3,557.32/)).toBeInTheDocument();
    expect(screen.getByText(/USD.*0.00/)).toBeInTheDocument();
    expect(screen.queryByText(/3,557.33/)).not.toBeInTheDocument();
  });
});
