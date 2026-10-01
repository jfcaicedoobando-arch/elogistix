import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const mock = vi.hoisted(() => ({ cuentas: vi.fn(), permisos: vi.fn() }));
vi.mock("@/features/tesoreria/hooks", () => ({ useCuentasBancarias: mock.cuentas }));
vi.mock("@/hooks/shared/usePermissions", () => ({ usePermissions: mock.permisos }));
vi.mock("@/features/tesoreria/hooks/useEstadoCuenta", () => ({
  useEstadoCuenta: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/features/tesoreria/components/DetallePagoSheet", () => ({ DetallePagoSheet: () => null }));
import TesoreriaEstadoCuenta from "../TesoreriaEstadoCuenta";

describe("N03/N04 · estado de cuenta sin cuentas", () => {
  beforeEach(() => {
    document.title = "Iniciar sesión · Libre Carga";
    mock.permisos.mockReturnValue({ canAdminCuentasBancarias: false });
    mock.cuentas.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
  });
  const abrir = () => render(<MemoryRouter><TesoreriaEstadoCuenta /></MemoryRouter>);
  it("explica la configuración faltante al contador, sin abrir un selector vacío", () => {
    abrir();
    expect(screen.getByText(/No hay cuentas bancarias activas/i)).toBeInTheDocument();
    expect(screen.getByText(/Solicita a un administrador/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Cuenta bancaria" })).toBeNull();
    expect(document.title).toBe("Estado de cuenta · Libre Carga");
  });
  it("no confunde un error de carga con una lista vacía", () => {
    mock.cuentas.mockReturnValue({ data: [], isLoading: false, isError: true, refetch: vi.fn() });
    abrir();
    expect(screen.getByText(/No se pudieron cargar las cuentas bancarias/i)).toBeInTheDocument();
    expect(screen.queryByText(/No hay cuentas bancarias activas/i)).toBeNull();
  });
  it("cuando sí existen cuentas sin seleccionar, muestra el selector y el mensaje correcto", () => {
    mock.cuentas.mockReturnValue({ data: [{ id: "c1", alias: "BBVA MXN", banco: "BBVA", moneda: "MXN" }], isLoading: false, isError: false, refetch: vi.fn() });
    abrir();
    expect(screen.getByRole("combobox", { name: "Cuenta bancaria" })).not.toBeDisabled();
    expect(screen.getByText(/Selecciona una cuenta para ver su estado de cuenta/i)).toBeInTheDocument();
  });
});
