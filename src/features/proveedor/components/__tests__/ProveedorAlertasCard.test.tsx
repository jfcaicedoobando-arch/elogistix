import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProveedorAlertasCard } from "@/features/proveedor/components/ProveedorAlertasCard";
import type { AlertasProveedor } from "@/features/proveedor/domain/inteligenciaProveedor";

const base: AlertasProveedor = {
  cerradosSinFactura: { count: 0, montoMxn: 0 },
  facturasPorVencer: { count: 0, montoMxn: 0 },
  facturasVencidas: { count: 0, montoMxn: 0 },
  saldoPendienteMxn: 0,
  bancariosIncompletos: false,
  documentosVencidos: 0,
  documentosPorVencer: 0,
};

describe("ProveedorAlertasCard", () => {
  it("muestra el estado al día cuando no hay alertas", () => {
    render(<ProveedorAlertasCard alertas={base} />);
    expect(screen.getByText(/está al día/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("lista las alertas con su monto", () => {
    render(
      <ProveedorAlertasCard
        alertas={{ ...base, facturasVencidas: { count: 2, montoMxn: 12345.67 } }}
      />,
    );
    const alertas = screen.getAllByRole("alert");
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toHaveTextContent("2 facturas vencidas");
    expect(alertas[0].textContent).toMatch(/12,345\.67/);
  });

  it("omite el monto cuando la alerta no tiene importe", () => {
    render(<ProveedorAlertasCard alertas={{ ...base, documentosVencidos: 1 }} />);
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent("1 documento vencido");
    expect(alerta.textContent).not.toMatch(/\$/);
  });
});
