import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimbradoResumen } from "../TimbradoConfirmacion";
import { TimbrarCompacto, TimbrarCompleto } from "../DialogTimbrarFactura.parts";

describe("confirmación de timbrado", () => {
  it("identifica ambiente, cliente/RFC e importe en moneda de la factura", () => {
    render(<TimbradoResumen ambiente="sandbox" cliente="Cliente de pruebas" rfc="XAXX010101000" total={116} moneda="MXN" />);
    expect(screen.getByText("Sandbox (pruebas)")).toBeInTheDocument();
    expect(screen.getByText(/Cliente de pruebas · XAXX010101000/)).toBeInTheDocument();
    expect(screen.getByText(/116\.00/)).toHaveTextContent("MXN");
  });
  for (const compacto of [true, false]) {
    it(`${compacto ? "compacto" : "completo"}: muestra el destinatario exacto y requiere elección`, () => {
      const setEnviarEmail = vi.fn();
      const props = { usoCfdi: "G03", formaPago: "03", metodoPago: "PUE", enviarEmail: false, setEnviarEmail, emailDestino: "fiscal@example.invalid" };
      render(compacto ? <TimbrarCompacto {...props} /> : <TimbrarCompleto {...props} receptor={{ rfc: "AAA010101AAA", regimen: "601" }} checks={[]} setUsoCfdi={vi.fn()} setFormaPago={vi.fn()} setMetodoPago={vi.fn()} puedeTimbrar />);
      const opcion = screen.getByRole("checkbox", { name: /fiscal@example.invalid/ });
      expect(opcion).not.toBeChecked();
      fireEvent.click(opcion);
      expect(setEnviarEmail).toHaveBeenCalledWith(true);
    });
  }
  it("no permite envío automático sin destinatario", () => {
    render(<TimbrarCompacto usoCfdi="G03" formaPago="03" metodoPago="PUE" enviarEmail={false} setEnviarEmail={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
