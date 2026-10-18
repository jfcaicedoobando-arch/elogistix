import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";

export function fixtureConcepts(): ConceptoManualInput[] {
  const params = new URLSearchParams(location.search);
  const count = Number(params.get("rows") ?? "20");
  if (![1, 20, 100].includes(count)) throw new Error("rows must be 1, 20 or 100");
  const types = ["gravado_16", "gravado_8", "tasa_0", "exento", "no_objeto"] as const;
  return Array.from({ length: count }, (_, i) => ({
    descripcion: `Servicio sintético ${i + 1}`, cantidad: 1.123456 + i % 3,
    precio_unitario: 123.4567 + i, clave_sat: "78101800", tipo_iva: types[i % types.length],
  }));
}
