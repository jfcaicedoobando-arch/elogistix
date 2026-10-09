import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FacturaSaldoResidualAlert } from "../FacturaSaldoResidualAlert";

describe("AUD54: aviso de residual documentado", () => {
  it("explica saldo PUE sin ofrecer segundo pago ni condonación", () => {
    render(<FacturaSaldoResidualAlert saldo={.01} pagado={1.15} estado="Pagada" metodoPago="PUE" moneda="MXN" />);
    expect(screen.getByRole("alert")).toHaveTextContent("0.01");
    expect(screen.getByRole("alert")).toHaveTextContent("no admite una segunda exhibición");
    expect(screen.getByRole("alert")).toHaveTextContent("Revisa el pago previo");
    expect(screen.queryByRole("button")).toBeNull();
  });
  it.each([
    { saldo: .0049, pagado: 1.15, estado: "Pagada" },
    { saldo: .01, pagado: 0, estado: "Pagada" },
    { saldo: .01, pagado: 1.15, estado: "Cancelada" },
    { saldo: .01, pagado: 1.15, estado: "Sustituida" },
  ])("sin aviso engañoso para $estado saldo $saldo pagado $pagado", (props) => {
    render(<FacturaSaldoResidualAlert {...props} metodoPago="PUE" moneda="MXN" />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
