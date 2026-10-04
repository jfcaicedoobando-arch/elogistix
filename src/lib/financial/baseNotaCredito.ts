import { subtotalLinea, sumarMontos } from "./financialUtils";

/** Base del desglose guardado; no se deduce IVA ni se prorratea el total bruto. */
export function baseNotaCreditoSinImpuestos(conceptos: unknown): number | null {
  if (!Array.isArray(conceptos) || conceptos.length === 0) return null;
  const bases: number[] = [];
  for (const concepto of conceptos) {
    if (!concepto || typeof concepto !== "object" || Array.isArray(concepto)) return null;
    const { cantidad, precio_unitario: precio } = concepto;
    if (![cantidad, precio].every((v) =>
      (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) && Number.isFinite(Number(v)),
    )) return null;
    if (Number(cantidad) <= 0 || Number(precio) < 0) return null;
    const base = subtotalLinea(Number(cantidad), Number(precio));
    if (!Number.isFinite(base)) return null;
    bases.push(base);
  }
  const subtotal = sumarMontos(bases);
  return Number.isFinite(subtotal) ? subtotal : null;
}

export interface NotaCreditoSinDesglose {
  id: string;
  folio: string | null;
}

export class NotaCreditoSinDesgloseError extends Error {
  readonly notas: readonly NotaCreditoSinDesglose[];

  constructor(notas: readonly NotaCreditoSinDesglose[] = []) {
    const detalle = notas.map(({ id, folio }) => `${folio || "Sin folio"} (ID: ${id || "no disponible"})`).join("; ");
    super(`No se puede calcular este mes sin IVA: hay notas de crédito sin un desglose válido de conceptos. Revisa su desglose antes de generar el reporte.${detalle ? ` Notas afectadas: ${detalle}.` : ""}`);
    this.name = "NotaCreditoSinDesgloseError";
    this.notas = notas.map(({ id, folio }) => ({ id, folio }));
  }
}
