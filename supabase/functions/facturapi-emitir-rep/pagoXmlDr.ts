/**
 * Serialización del nodo `pago20:DoctoRelacionado` del Complemento de Pagos 2.0.
 *
 * Se arma a mano porque la API de Facturapi sólo acepta
 * `related_documents[].taxes` y NO expone `ObjetoImpDR` (confirmado por ticket):
 * la alternativa soportada es enviar el XML del complemento en `complements`.
 * Aquí NO se recalcula nada: bases, tasas y prorrateos vienen de
 * `helpers.ts · buildTaxesDr`.
 */
export type FactorXml = "Tasa" | "Exento";

export interface TrasladoXml {
  base: number;
  tasa: number;
  factor: FactorXml;
}

export interface RetencionXml {
  tipo: "IVA" | "ISR";
  base: number;
  tasa: number;
}

export interface DoctoRelacionadoXml {
  uuid: string;
  serie?: string | null;
  folio?: string | null;
  moneda_dr: string;
  /** EquivalenciaDR: unidades de la moneda del documento por 1 de la moneda del pago. */
  equivalencia_dr?: number | null;
  num_parcialidad: number;
  imp_saldo_ant: number;
  imp_pagado: number;
  imp_saldo_insoluto: number;
  /** "01" = No objeto de impuesto (sin nodo ImpuestosDR); "02" = sí objeto. */
  objeto_imp_dr: "01" | "02";
  traslados: TrasladoXml[];
  retenciones: RetencionXml[];
}

/** Acumulado en MXN para el nodo `pago20:Totales` (lo exige el SAT en pesos). */
export interface TotalesAcumulados {
  base16: number;
  imp16: number;
  base8: number;
  imp8: number;
  base0: number;
  imp0: number;
  baseExento: number;
  retIva: number;
  retIsr: number;
}

export const IMPUESTO_SAT: Record<"IVA" | "ISR", string> = { IVA: "002", ISR: "001" };

export function totalesVacios(): TotalesAcumulados {
  return { base16: 0, imp16: 0, base8: 0, imp8: 0, base0: 0, imp0: 0, baseExento: 0, retIva: 0, retIsr: 0 };
}

/** Escapa un valor para usarlo como atributo XML. */
export function xmlAttr(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Importes fiscales: siempre 2 decimales. */
export function n2(valor: number): string {
  return (Math.round(valor * 100) / 100).toFixed(2);
}

/** Tasas del catálogo SAT: 6 decimales fijos. */
export function n6(valor: number): string {
  return valor.toFixed(6);
}

/** Tipos de cambio / equivalencias: hasta `max` decimales, sin ceros de relleno. */
export function nDec(valor: number, max: number): string {
  const fijo = valor.toFixed(max);
  if (!fijo.includes(".")) return fijo;
  const recortado = fijo.replace(/0+$/, "").replace(/\.$/, "");
  return recortado === "" ? "0" : recortado;
}

function atributos(pares: ReadonlyArray<readonly [string, string | null | undefined]>): string {
  return pares
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}="${xmlAttr(String(v))}"`)
    .join(" ");
}

function round2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Convierte un importe del documento relacionado a MXN para el nodo Totales. */
function aMxn(valorDr: number, equivalenciaDr: number | null | undefined, tipoCambioP: number): number {
  const equivalencia = equivalenciaDr && equivalenciaDr > 0 ? equivalenciaDr : 1;
  const cambio = tipoCambioP > 0 ? tipoCambioP : 1;
  return (valorDr / equivalencia) * cambio;
}

function acumularTraslado(
  t: TrasladoXml,
  importe: number,
  mxn: (v: number) => number,
  totales: TotalesAcumulados,
): void {
  if (t.factor === "Exento") {
    totales.baseExento += mxn(t.base);
    return;
  }
  if (Math.abs(t.tasa - 0.16) < 1e-6) {
    totales.base16 += mxn(t.base);
    totales.imp16 += mxn(importe);
  } else if (Math.abs(t.tasa - 0.08) < 1e-6) {
    totales.base8 += mxn(t.base);
    totales.imp8 += mxn(importe);
  } else {
    totales.base0 += mxn(t.base);
    totales.imp0 += mxn(importe);
  }
}

function trasladoDrXml(t: TrasladoXml, importe: number): string {
  return `<pago20:TrasladoDR ${atributos([
    ["BaseDR", n2(t.base)],
    ["ImpuestoDR", IMPUESTO_SAT.IVA],
    ["TipoFactorDR", t.factor],
    ["TasaOCuotaDR", t.factor === "Exento" ? null : n6(t.tasa)],
    ["ImporteDR", t.factor === "Exento" ? null : n2(importe)],
  ])}/>`;
}

function retencionDrXml(r: RetencionXml, importe: number): string {
  return `<pago20:RetencionDR ${atributos([
    ["BaseDR", n2(r.base)],
    ["ImpuestoDR", IMPUESTO_SAT[r.tipo]],
    ["TipoFactorDR", "Tasa"],
    ["TasaOCuotaDR", n6(r.tasa)],
    ["ImporteDR", n2(importe)],
  ])}/>`;
}

/** Nodo `ImpuestosDR`. Vacío (cadena vacía) cuando ObjetoImpDR = 01. */
function impuestosDrXml(
  d: DoctoRelacionadoXml,
  mxn: (v: number) => number,
  totales: TotalesAcumulados,
): string {
  if (d.objeto_imp_dr !== "02") return "";
  const retenciones = d.retenciones.map((r) => {
    const importe = round2(r.base * r.tasa);
    totales[r.tipo === "IVA" ? "retIva" : "retIsr"] += mxn(importe);
    return retencionDrXml(r, importe);
  });
  const traslados = d.traslados.map((t) => {
    const importe = t.factor === "Exento" ? 0 : round2(t.base * t.tasa);
    acumularTraslado(t, importe, mxn, totales);
    return trasladoDrXml(t, importe);
  });
  if (retenciones.length === 0 && traslados.length === 0) return "";
  // Orden del XSD (igual que el nodo Impuestos del CFDI): Retenciones y luego Traslados.
  const bloques = [
    retenciones.length > 0 ? `<pago20:RetencionesDR>${retenciones.join("")}</pago20:RetencionesDR>` : "",
    traslados.length > 0 ? `<pago20:TrasladosDR>${traslados.join("")}</pago20:TrasladosDR>` : "",
  ];
  return `<pago20:ImpuestosDR>${bloques.join("")}</pago20:ImpuestosDR>`;
}

/**
 * Nodo `pago20:DoctoRelacionado` completo. Acumula en `totales` (en MXN) lo que
 * el nodo `Totales` del complemento debe declarar.
 */
export function doctoRelacionadoXml(
  d: DoctoRelacionadoXml,
  tipoCambioP: number,
  totales: TotalesAcumulados,
): string {
  const mxn = (v: number) => aMxn(v, d.equivalencia_dr, tipoCambioP);
  const attrs = atributos([
    ["IdDocumento", d.uuid],
    ["Serie", d.serie ?? null],
    ["Folio", d.folio ?? null],
    ["MonedaDR", d.moneda_dr],
    ["EquivalenciaDR", d.equivalencia_dr && d.equivalencia_dr > 0 ? nDec(d.equivalencia_dr, 10) : null],
    ["NumParcialidad", String(d.num_parcialidad)],
    ["ImpSaldoAnt", n2(d.imp_saldo_ant)],
    ["ImpPagado", n2(d.imp_pagado)],
    ["ImpSaldoInsoluto", n2(d.imp_saldo_insoluto)],
    ["ObjetoImpDR", d.objeto_imp_dr],
  ]);
  const impuestos = impuestosDrXml(d, mxn, totales);
  return impuestos === ""
    ? `<pago20:DoctoRelacionado ${attrs}/>`
    : `<pago20:DoctoRelacionado ${attrs}>${impuestos}</pago20:DoctoRelacionado>`;
}
