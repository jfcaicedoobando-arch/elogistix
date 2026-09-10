import { describe, it, expect } from "vitest";
import {
  sugerirFormaPagoNC,
  conceptoPorSaldo,
  aplicarPorcentaje,
  conceptosSeleccionados,
  USO_CFDI_NC,
  FORMA_PAGO_SIN_COBRO,
  FORMA_PAGO_COBRADA_DEFAULT,
} from "../notaCreditoSugerencias";
import { calcularTotalConIVA, subtotalLinea } from "@/lib/financial/financialUtils";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";

const base: ConceptoNotaCredito = {
  descripcion: "Flete marítimo",
  cantidad: 1,
  precio_unitario: 1000,
  clave_sat: "84111506",
  clave_unidad: "E48",
  unidad: "Unidad de servicio",
  tasa_iva: 0.16,
};

describe("notaCreditoSugerencias", () => {
  it("el uso de CFDI de una NC siempre es G02", () => {
    expect(USO_CFDI_NC).toBe("G02");
  });

  it("factura sin cobros sugiere 15 Condonación", () => {
    const s = sugerirFormaPagoNC({ facturaCobrada: false, formaPagoCobro: "03" });
    expect(s.formaPago).toBe(FORMA_PAGO_SIN_COBRO);
    expect(s.explicacion).toMatch(/Condonación/);
  });

  it("factura cobrada replica la forma del cobro", () => {
    expect(sugerirFormaPagoNC({ facturaCobrada: true, formaPagoCobro: "02" }).formaPago).toBe("02");
  });

  it("factura cobrada sin forma conocida cae en 03", () => {
    expect(sugerirFormaPagoNC({ facturaCobrada: true, formaPagoCobro: "  " }).formaPago).toBe(
      FORMA_PAGO_COBRADA_DEFAULT,
    );
  });

  it("el concepto por saldo iguala el saldo con IVA incluido", () => {
    const c = conceptoPorSaldo(1160, base, 0.16);
    expect(c.precio_unitario).toBe(1000);
    const total = calcularTotalConIVA(subtotalLinea(c.cantidad, c.precio_unitario), 0.16);
    expect(total).toBeCloseTo(1160, 2);
  });

  it("saldo inválido no produce importes negativos", () => {
    expect(conceptoPorSaldo(-5, base).precio_unitario).toBe(0);
    expect(conceptoPorSaldo(Number.NaN, base).precio_unitario).toBe(0);
  });

  it("aplica un porcentaje sobre los precios y acota el rango", () => {
    expect(aplicarPorcentaje([base], 10)[0].precio_unitario).toBe(100);
    expect(aplicarPorcentaje([base], 250)[0].precio_unitario).toBe(1000);
    expect(aplicarPorcentaje([base], -5)[0].precio_unitario).toBe(0);
  });

  it("selecciona sólo los conceptos marcados y los copia", () => {
    const otro = { ...base, descripcion: "Maniobras", precio_unitario: 500 };
    const out = conceptosSeleccionados([base, otro], [1]);
    expect(out).toHaveLength(1);
    expect(out[0].descripcion).toBe("Maniobras");
    expect(out[0]).not.toBe(otro);
  });
});
