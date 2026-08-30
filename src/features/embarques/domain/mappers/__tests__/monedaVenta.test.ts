/**
 * Ola 2 · A — La captura de VENTA sólo acepta MXN/USD; los COSTOS conservan EUR.
 */
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { monedaSchema, monedaVentaSchema } from "../embarquePayloadSchemas";
import { buildConceptosVentaPayload, buildConceptosCostoPayload } from "../embarqueToDb";
import type { ConceptoVentaLocal, ConceptoCostoLocal } from "@/types/concepto";

const venta = (moneda: string): ConceptoVentaLocal => ({
  id: 1, concepto: "Flete", cantidad: 1, precioUnitario: 100, moneda,
});

const costo = (moneda: string): ConceptoCostoLocal => ({
  id: 1, proveedorId: "", concepto: "Flete", monto: 100, moneda,
});

describe("moneda de conceptos de venta", () => {
  it("el schema de venta acepta MXN/USD y rechaza EUR", () => {
    expect(monedaVentaSchema.parse("MXN")).toBe("MXN");
    expect(monedaVentaSchema.parse("USD")).toBe("USD");
    expect(() => monedaVentaSchema.parse("EUR")).toThrow();
  });

  it("el payload de venta rechaza EUR", () => {
    expect(() => buildConceptosVentaPayload([venta("EUR")])).toThrow();
    expect(buildConceptosVentaPayload([venta("USD")])[0].moneda).toBe("USD");
  });

  it("los costos conservan EUR", () => {
    expect(monedaSchema.parse("EUR")).toBe("EUR");
    expect(buildConceptosCostoPayload([costo("EUR")], [])[0].moneda).toBe("EUR");
  });

  it("el selector de moneda de venta no ofrece EUR", () => {
    const src = readFileSync(
      "src/features/embarques/components/conceptos/FilaVentaPrecio.tsx",
      "utf8",
    );
    expect(src).not.toContain('SelectItem value="EUR"');
    expect(src).toContain('SelectItem value="USD"');
  });
});
