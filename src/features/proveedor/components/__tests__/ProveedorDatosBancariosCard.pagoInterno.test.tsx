import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProveedorDatosBancariosCard } from "../ProveedorDatosBancariosCard";

describe("Ayuda bancaria del proveedor (69)", () => {
  it.each(["Nacional", "Extranjero"] as const)("permite registrar pago interno sin datos %s", (origen) => {
    render(<ProveedorDatosBancariosCard banco={null} clabe={null} origen={origen} onCapturar={vi.fn()} />);
    expect(screen.getByText(/Puedes registrar un pago interno/)).toHaveTextContent("cuenta de origen");
    expect(screen.queryByText(/no se puede registrar el pago/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Capturar datos bancarios" })).toBeEnabled();
  });
});
