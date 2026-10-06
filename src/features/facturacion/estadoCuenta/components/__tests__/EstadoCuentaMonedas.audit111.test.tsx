import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EstadoCuentaKpiCards } from "../EstadoCuentaKpiCards";
import { EstadoCuentaAgingBar } from "../EstadoCuentaAgingBar";
import { EstadoCuentaFilters } from "../EstadoCuentaFilters";
import { formatCurrency } from "@/lib/formatters";

const montos = { mxn: 10, usd: 2, eur: 1 };

describe("AUD111: EUR visible en estado de cuenta", () => {
  it("muestra las tres monedas en las tres tarjetas sin depender de tooltip", () => {
    render(<TooltipProvider><EstadoCuentaKpiCards kpis={{
      adeudado: montos, vencido: montos, aFavor: montos, facturasAdeudadas: 3, facturasVencidas: 3,
    }} /></TooltipProvider>);
    expect(screen.getAllByText(formatCurrency(10, "MXN"))).toHaveLength(3);
    expect(screen.getAllByText(`+ ${formatCurrency(2, "USD")}`)).toHaveLength(3);
    expect(screen.getAllByText(`+ ${formatCurrency(1, "EUR")}`)).toHaveLength(3);
  });

  it("EUR solo es el importe principal, con saldo y crédito disponibles", () => {
    render(<TooltipProvider><EstadoCuentaKpiCards kpis={{
      adeudado: { mxn: 0, usd: 0, eur: 1 }, vencido: { mxn: 0, usd: 0, eur: 1 },
      aFavor: { mxn: 0, usd: 0, eur: 2 }, facturasAdeudadas: 1, facturasVencidas: 1,
    }} /></TooltipProvider>);
    expect(screen.getAllByText(formatCurrency(1, "EUR"))).toHaveLength(2);
    expect(screen.getByText(formatCurrency(2, "EUR"))).toBeVisible();
    expect(screen.getByText("Disponible para aplicar")).toBeVisible();
    expect(screen.queryByText("Sin adeudos")).toBeNull();
    expect(screen.queryByText("Al corriente")).toBeNull();
  });

  it("conserva EUR y su selección en la barra de antigüedad", () => {
    const onToggle = vi.fn();
    render(<EstadoCuentaAgingBar buckets={[{ id: "vigente", label: "Vigente", ...montos, conteo: 3 }]}
      activo="vigente" onToggle={onToggle} />);
    const bucket = screen.getByRole("button", { name: /Vigente/ });
    expect(bucket).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(formatCurrency(1, "EUR"))).toBeVisible();
    fireEvent.click(bucket);
    expect(onToggle).toHaveBeenCalledWith("vigente");
  });

  it("ofrece EUR en el selector de moneda", () => {
    const onMonedaChange = vi.fn();
    render(<EstadoCuentaFilters moneda="todas" onMonedaChange={onMonedaChange}
      presetActivo="30d" onPreset={vi.fn()} soloConSaldo={false} onSoloConSaldoChange={vi.fn()}
      busqueda="" onBusquedaChange={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Moneda" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "EUR" }));
    expect(onMonedaChange).toHaveBeenCalledWith("EUR");
  });
});
