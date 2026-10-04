import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TraspasoSaldoOrigen } from "../TraspasoSaldoOrigen";
const query = vi.hoisted(() => ({ data: [{ id: "banorte", moneda: "MXN", saldo: 966.13 }, { id: "usd", moneda: "USD", saldo: 100 }], isLoading: false, isError: false, refetch: vi.fn() }));
vi.mock("@/features/tesoreria/hooks/useTesoreriaCuentas", () => ({ useSaldosCuentas: () => query }));

describe("Proyección informativa de saldo en origen", () => {
  it.each([[900, "66.13", false], [966.13, "0.00", false], [1025, "-58.87", true]])(
    "proyecta cargo con comisión %s sin imponer un bloqueo nuevo", (cargo, saldo, aviso) => {
      render(<TraspasoSaldoOrigen cuentaId="banorte" moneda="MXN" cargo={cargo} />);
      expect(screen.getByText(/Saldo actual/)).toHaveTextContent("966.13");
      expect(screen.getByText(/Saldo proyectado después/)).toHaveTextContent(saldo);
      expect(!!screen.queryByRole("status")).toBe(aviso);
    },
  );
  it("cambiar origen utiliza el saldo y moneda de la cuenta elegida", () => {
    const { rerender } = render(<TraspasoSaldoOrigen cuentaId="banorte" moneda="MXN" cargo={1025} />);
    rerender(<TraspasoSaldoOrigen cuentaId="usd" moneda="USD" cargo={20} />);
    expect(screen.getByText(/Saldo actual/)).toHaveTextContent("USD 100.00");
    expect(screen.getByText(/Saldo proyectado después/)).toHaveTextContent("USD 80.00");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("un error de consulta no fabrica saldo cero y ofrece reintentar", () => {
    query.isError = true;
    render(<TraspasoSaldoOrigen cuentaId="banorte" moneda="MXN" cargo={20} />);
    expect(screen.getByRole("alert")).toHaveTextContent("proyección no está disponible");
    expect(screen.queryByText(/Saldo proyectado después/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(query.refetch).toHaveBeenCalledOnce(); query.isError = false;
  });
});
