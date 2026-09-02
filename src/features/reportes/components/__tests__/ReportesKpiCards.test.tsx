/**
 * DEFECTO 8: advertencia visible cuando `embarquesSinTc > 0` y ausente
 * cuando es 0.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ReportesKpiCards from "../ReportesKpiCards";

const kpisBase = { totalClientes: 3, revenue: 1000, profit: 200, margenProm: 20 };

describe("ReportesKpiCards — advertencia de embarques sin TC", () => {
  it("no muestra advertencia cuando embarquesSinTc es 0", () => {
    render(<ReportesKpiCards kpis={{ ...kpisBase, embarquesSinTc: 0 }} isLoading={false} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("muestra advertencia (singular) cuando embarquesSinTc es 1", () => {
    render(<ReportesKpiCards kpis={{ ...kpisBase, embarquesSinTc: 1 }} isLoading={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/hay 1 embarque sin tipo de cambio resuelto/i);
  });

  it("muestra advertencia (plural) cuando embarquesSinTc > 1", () => {
    render(<ReportesKpiCards kpis={{ ...kpisBase, embarquesSinTc: 4 }} isLoading={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/hay 4 embarques sin tipo de cambio resuelto/i);
  });

  it("no muestra advertencia mientras está cargando, aunque haya embarquesSinTc > 0", () => {
    render(<ReportesKpiCards kpis={{ ...kpisBase, embarquesSinTc: 2 }} isLoading />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
