import { describe, it, expect } from "vitest";
import { esFacturaPorPagar } from "../cxpPorPagarFiltro";
import type { FacturaCxP, EstatusCxP } from "../proveedorFacturas";

function factura(saldo: number, estatus: EstatusCxP): Pick<FacturaCxP, "saldo" | "estatus"> {
  return { saldo, estatus };
}

describe("esFacturaPorPagar", () => {
  it("incluye facturas 'Por aprobar' con saldo (Q-15.6)", () => {
    expect(esFacturaPorPagar(factura(1000, "Por aprobar"))).toBe(true);
  });

  it("incluye 'Vencida' y 'Por vencer'", () => {
    expect(esFacturaPorPagar(factura(500, "Vencida"))).toBe(true);
    expect(esFacturaPorPagar(factura(500, "Por vencer"))).toBe(true);
  });

  it("excluye 'Rechazada' y 'Cancelada'", () => {
    expect(esFacturaPorPagar(factura(500, "Rechazada"))).toBe(false);
    expect(esFacturaPorPagar(factura(500, "Cancelada"))).toBe(false);
  });

  it("excluye facturas sin saldo pendiente", () => {
    expect(esFacturaPorPagar(factura(0, "Vigente"))).toBe(false);
    expect(esFacturaPorPagar(factura(-10, "Vigente"))).toBe(false);
  });
});
