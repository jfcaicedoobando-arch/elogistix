import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FacturasEmitidasFooter } from "../FacturasEmitidasFooter";

vi.mock("@/features/catalogos/hooks/useExchangeRates", () => ({ useExchangeRates: () => ({ data: { usdMxn: 20 } }) }));
const borradores = Array.from({ length: 10 }, () => ({ total: 100, moneda: "MXN", estado: "Borrador" }));

describe("Emitidas - ámbitos del totalizador", () => {
  it("distingue once filas de una factura incluida sin sumar diez borradores", () => {
    render(<FacturasEmitidasFooter facturas={[{ total: 116, moneda: "MXN", estado: "Pagada" }, ...borradores]} />);
    expect(screen.getByText("Filas visibles").nextElementSibling).toHaveTextContent("11");
    expect(screen.getByText("Facturas incluidas en totales").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Borrador / por timbrar (excluidas)").nextElementSibling).toHaveTextContent("10");
    expect(screen.getByText("Subtotal MXN").nextElementSibling).toHaveTextContent("MXN 116.00");
  });

  it("informa las filas aunque todas estén en preparación", () => {
    render(<FacturasEmitidasFooter facturas={borradores} />);
    expect(screen.getByText("Facturas incluidas en totales").nextElementSibling).toHaveTextContent("0");
    expect(screen.getByText("Filas visibles").nextElementSibling).toHaveTextContent("10");
  });
});
