import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AvisoVencidosFueraProyeccion } from "../AvisoVencidosFueraProyeccion";
import { CuentasBancariasEmptyState } from "../CuentasBancariasEmptyState";
describe("Avisos N02/N03", () => {
  it("explica exclusiones y ofrece navegación sin convertir USD a MXN", () => {
    render(<MemoryRouter><AvisoVencidosFueraProyeccion resumen={{
      anteriores_a: "2026-09-28", entradas: { cantidad: 0, por_moneda: {} },
      salidas: { cantidad: 2, por_moneda: { MXN: 5331.1, USD: 700 } },
    }} /></MemoryRouter>);
    expect(screen.getByText(/no se incluyen en las semanas ni en los totales/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Revisar pagos programados/i })).toHaveAttribute("href", "/tesoreria/pagos-programados");
    expect(screen.getByText(/pendientes de aprobación/i)).toBeInTheDocument();
  });
  it("no muestra un aviso cuando no hay vencidos anteriores", () => {
    const { container } = render(<AvisoVencidosFueraProyeccion resumen={{ anteriores_a: "2026-09-28",
      entradas: { cantidad: 0, por_moneda: {} }, salidas: { cantidad: 0, por_moneda: {} } }} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("guía al contador sin conceder acciones de administración", () => {
    render(<CuentasBancariasEmptyState puedeAdministrar={false} onAdministrar={() => {}} />);
    expect(screen.getByText(/Solicita a un administrador/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    render(<CuentasBancariasEmptyState puedeAdministrar onAdministrar={() => {}} />);
    expect(screen.getByRole("button", { name: /Administrar cuentas/i })).toBeInTheDocument();
  });
});
