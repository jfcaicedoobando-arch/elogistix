import { describe, it, expect } from "vitest";
import { resolverTasa } from "@/features/facturacion/services/conceptosFacturaShared";
import { calcularTotalesConceptos } from "@/features/facturacion/utils/totalesConceptos";
import { tasaAplicada } from "@/features/facturacion/services/facturaManualLineas";

describe("Conceptos de factura — no objeto de impuesto (SAT 01)", () => {
  it("no tiene tasa de traslado, igual que exento pero distinto de tasa 0", () => {
    expect(resolverTasa("no_objeto")).toBeNull();
    expect(resolverTasa("exento")).toBeNull();
    expect(resolverTasa("tasa_0")).toBe(0);
    expect(resolverTasa("gravado_8")).toBe(0.08);
  });

  it("no aporta IVA a los totales de la factura manual", () => {
    const totales = calcularTotalesConceptos(
      [
        { descripcion: "Servicio no objeto", cantidad: 1, precio_unitario: 1000, tipo_iva: "no_objeto" },
        { descripcion: "Maniobras", cantidad: 1, precio_unitario: 1000, tipo_iva: "gravado_16" },
      ],
      0.16,
    );
    expect(totales.subtotal).toBe(2000);
    expect(totales.iva).toBe(160);
    expect(totales.total).toBe(2160);
  });

  it("las líneas manuales no llevan tasa cuando son no objeto", () => {
    expect(tasaAplicada("no_objeto", 0.16)).toBeNull();
    expect(tasaAplicada("gravado_16", 0.16)).toBe(0.16);
    expect(tasaAplicada("tasa_0", 0.16)).toBe(0);
  });
});
