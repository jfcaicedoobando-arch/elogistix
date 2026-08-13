import { describe, expect, it } from "vitest";
import { ordenanteSugerido } from "../refacturarWizardDerivados";

const receptor = {
  nombre: "Cliente Destino SA",
  rfc: "abc010101aaa",
  regimen_fiscal: "601",
  codigo_postal: "44100",
};

describe("ordenanteSugerido", () => {
  it("toma el receptor de la factura viva", () => {
    const r = ordenanteSugerido(
      { numero: "F1035", cliente_nombre: "Nueva Empresa SA", rfc_cliente: "xyz010101bbb" },
      receptor,
    );
    expect(r).toEqual({
      nombre: "Nueva Empresa SA",
      rfc: "XYZ010101BBB",
      origen: "factura_nueva",
      numeroFactura: "F1035",
    });
  });

  it("usa el cliente destino como respaldo", () => {
    const r = ordenanteSugerido({ numero: "F1035", cliente_nombre: "  ", rfc_cliente: null }, receptor);
    expect(r?.origen).toBe("cliente_destino");
    expect(r?.nombre).toBe("Cliente Destino SA");
    expect(r?.rfc).toBe("ABC010101AAA");
  });

  it("devuelve null sin datos", () => {
    expect(ordenanteSugerido(null, null)).toBeNull();
  });
});
