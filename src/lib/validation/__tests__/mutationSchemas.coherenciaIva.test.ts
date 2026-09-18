import { describe, it, expect } from "vitest";
import { cotizacionUpdateSchema } from "@/lib/validation/mutationSchemas.cotizacion";

const concepto = (extra: Record<string, unknown>) => ({
  descripcion: "Flete marítimo",
  cantidad: 1,
  precio_unitario: 1000,
  total: 1160,
  ...extra,
});

describe("cotizacionUpdateSchema — coherencia de IVA en escritura", () => {
  it("rechaza guardar 'tasa 0%' con una tasa de 16%", () => {
    const r = cotizacionUpdateSchema.safeParse({
      conceptos_venta: [concepto({ tipo_iva: "tasa_0", tasa_iva_aplicada: 0.16, aplica_iva: true })],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toContain("Flete marítimo");
  });

  it("rechaza guardar gravado con el IVA apagado", () => {
    const r = cotizacionUpdateSchema.safeParse({
      conceptos_venta: [concepto({ tipo_iva: "gravado_16", tasa_iva_aplicada: null, aplica_iva: false })],
    });
    expect(r.success).toBe(false);
  });

  it("acepta gravado, exento y no objeto bien clasificados", () => {
    const r = cotizacionUpdateSchema.safeParse({
      conceptos_venta: [
        concepto({ tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, aplica_iva: true }),
        concepto({ tipo_iva: "gravado_8", tasa_iva_aplicada: 0.08, aplica_iva: true }),
        concepto({ tipo_iva: "exento", tasa_iva_aplicada: 0, aplica_iva: false }),
        concepto({ tipo_iva: "no_objeto", tasa_iva_aplicada: null, aplica_iva: false }),
      ],
    });
    expect(r.success).toBe(true);
  });

  it("permite editar una fila heredada ambigua sin cambiar su tratamiento", () => {
    // Los 233 registros históricos (IVA apagado + tasa 0.16 + sin tipo) siguen
    // siendo editables: sólo se bloquean al timbrar, no al guardar.
    const r = cotizacionUpdateSchema.safeParse({
      conceptos_venta: [concepto({ aplica_iva: false, tasa_iva_aplicada: 0.16, precio_unitario: 1200 })],
    });
    expect(r.success).toBe(true);
  });
});
