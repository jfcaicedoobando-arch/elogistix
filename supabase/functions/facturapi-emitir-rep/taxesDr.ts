/**
 * Impuestos del documento relacionado del REP (Complemento de Pagos 2.0).
 * Nunca se omite el arreglo: Facturapi rechaza el REP con
 * `complements.0.data.0.related_documents.0.taxes es requerido` cuando la
 * factura original no trae IVA. Para facturas exentas se declara factor
 * `Exento` con tasa 0.
 * Extraído de `helpers.ts` para respetar el límite de líneas por archivo.
 */
import type { FactorIva, FacturapiRepPayload, PagoContext } from "./helpers.ts";

type TaxesDr = FacturapiRepPayload["complements"][0]["data"][0]["related_documents"][0]["taxes"];
type DrTaxes = Pick<
  PagoContext["documento_relacionado"],
  "tasa_iva" | "imp_pagado" | "factor_iva" | "retenciones" | "subtotal_factura" | "total_factura" | "grupos_iva" | "importe_no_objeto" | "objeto_imp_dr"
>;

export function buildTaxesDr(dr: DrTaxes): TaxesDr {
  // Documento completamente "no objeto": sin ImpuestosDR (ni traslados ni
  // retenciones, que tampoco son representables sobre un renglón sin objeto).
  if (dr.objeto_imp_dr === "01") return [];
  const grupos = dr.grupos_iva ?? [];
  const taxes: TaxesDr = grupos.length > 0 ? trasladosPorGrupo(dr, grupos) : [trasladoUnico(dr)];
  // BaseDR total del pago (sin IVA): respaldo para retenciones legacy que no
  // traen el importe de sus renglones.
  const baseTotal = round2(taxes.reduce((acc, t) => acc + t.base, 0));
  // P1 · Auditoría IVA — una RetencionDR por impuesto+tasa, con BaseDR
  // prorrateada sobre los renglones que SÍ la traen (antes se usaba la base
  // completa del documento y la retención salía inflada).
  const denominador = grupos.length > 0 ? denominadorDocumento(dr, grupos) : 0;
  for (const ret of dr.retenciones ?? []) {
    if (!(ret.tasa > 0)) continue;
    const importe = Number(ret.importe ?? 0);
    const base = denominador > 0 && importe > 0
      ? round2((dr.imp_pagado * importe) / denominador)
      : baseTotal;
    taxes.push({ type: ret.tipo, rate: ret.tasa, factor: "Tasa", withholding: true, base });
  }
  return taxes;
}

/** Camino legacy: un solo traslado (facturas sin renglones capturados). */
function trasladoUnico(dr: DrTaxes): TaxesDr[number] {
  const tasa = dr.tasa_iva > 0 ? dr.tasa_iva : 0;
  const factor: FactorIva = tasa > 0 ? "Tasa" : (dr.factor_iva ?? "Tasa");
  // Ola 12 · R3P-18 (guía de llenado SAT, complemento de pagos 2.0): la BaseDR
  // es SIN IVA. Con tasa 0 / exento la base es el pago completo (v13.559.1).
  const base = tasa > 0 ? baseDrSinIva(dr) : round2(dr.imp_pagado);
  return { type: "IVA", rate: tasa, factor, withholding: false, base };
}

/**
 * P1 · Auditoría IVA — un traslado por grupo del CFDI original con la BaseDR
 * prorrateada: base_grupo = imp_pagado × importe_grupo / total_documento.
 * El último grupo absorbe el redondeo para que la suma cuadre exactamente con
 * la base del pago (imp_pagado × subtotal / total).
 */
function trasladosPorGrupo(
  dr: DrTaxes,
  grupos: NonNullable<DrTaxes["grupos_iva"]>,
): TaxesDr {
  const denominador = denominadorDocumento(dr, grupos);
  const sumaImportes = grupos.reduce((acc, g) => acc + g.importe, 0);
  const baseTotal = round2((dr.imp_pagado * sumaImportes) / denominador);
  let acumulado = 0;
  return grupos.map((g, i) => {
    const esUltimo = i === grupos.length - 1;
    const base = esUltimo
      ? round2(baseTotal - acumulado)
      : round2((dr.imp_pagado * g.importe) / denominador);
    acumulado = round2(acumulado + base);
    return { type: "IVA" as const, rate: g.tasa, factor: g.factor, withholding: false, base };
  });
}

/**
 * Total del CFDI original: se prefiere el dato guardado (incluye retenciones);
 * si falta, se reconstruye con los importes y tasas de los grupos.
 */
function denominadorDocumento(dr: DrTaxes, grupos: NonNullable<DrTaxes["grupos_iva"]>): number {
  const total = Number(dr.total_factura ?? 0);
  const sub = Number(dr.subtotal_factura ?? 0);
  // Los renglones "no objeto" no causan impuesto, pero SÍ forman parte del
  // documento: deben entrar al denominador o las bases saldrían infladas.
  const noObjeto = Number(dr.importe_no_objeto ?? 0);
  const sumaImportes = grupos.reduce((acc, g) => acc + g.importe, 0) + noObjeto;
  // El total guardado sólo es comparable si el subtotal coincide con los
  // importes de los renglones (evita bases falsas por facturas desincronizadas).
  if (total > 0 && sub > 0 && Math.abs(sub - sumaImportes) < 0.05) return total;
  const reconstruido = grupos.reduce((acc, g) => acc + g.importe * (1 + g.tasa), 0) + noObjeto;
  return reconstruido > 0 ? reconstruido : 1;
}

/**
 * R3P-18: BaseDR sin IVA. Sin retenciones: imp_pagado/(1+tasa). Con
 * retenciones el total del CFDI no es subtotal·(1+tasa), así que se usa la
 * proporción subtotal/total del documento original.
 */
function baseDrSinIva(
  dr: Pick<PagoContext["documento_relacionado"], "tasa_iva" | "imp_pagado" | "retenciones" | "subtotal_factura" | "total_factura">,
): number {
  const hayRetenciones = (dr.retenciones ?? []).some((r) => r.tasa > 0);
  const sub = Number(dr.subtotal_factura ?? 0);
  const tot = Number(dr.total_factura ?? 0);
  if (hayRetenciones && sub > 0 && tot > 0) {
    return round2((dr.imp_pagado * sub) / tot);
  }
  return round2(dr.imp_pagado / (1 + dr.tasa_iva));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
