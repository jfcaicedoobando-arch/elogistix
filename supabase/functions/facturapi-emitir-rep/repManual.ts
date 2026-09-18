/**
 * Ruta "XML manual" del REP: sólo para facturas PPD con renglones
 * "No objeto de impuesto" (SAT ObjetoImp 01).
 *
 * La vía estructurada de Facturapi (`complements[0].data[0].related_documents`)
 * no expone `ObjetoImpDR`, así que esos renglones no se pueden representar sin
 * falsear el tratamiento. Facturapi confirmó por ticket que la alternativa
 * soportada es enviar el XML del complemento dentro del nodo `complements`.
 *
 * Todo lo demás del comprobante (receptor, serie, `external_id` del claim,
 * sección de referencias del PDF) se conserva igual, y la aritmética de bases y
 * tasas se reutiliza tal cual de `helpers.ts · buildTaxesDr`.
 */
import { buildPagoComplementoXml, type DoctoRelacionadoXml } from "./pagoXml.ts";
import { normalizarFormaPago, type FacturapiRepPayload, type PagoContext } from "./helpers.ts";

/**
 * Envoltura con la que Facturapi recibe un complemento en XML crudo. Si el
 * proveedor cambia el nombre del campo, este es el ÚNICO lugar a ajustar.
 */
export const COMPLEMENTO_XML_TYPE = "custom";

/** `true` cuando la factura relacionada trae renglones "no objeto" (SAT 01). */
export function requiereXmlManual(
  dr: Pick<PagoContext["documento_relacionado"], "hay_no_objeto">,
): boolean {
  return dr.hay_no_objeto === true;
}

/** Documento relacionado del XML, tomado del payload estructurado ya calculado. */
export function doctoRelacionadoDesdePayload(
  payload: FacturapiRepPayload,
  ctx: PagoContext,
): DoctoRelacionadoXml {
  const dr = ctx.documento_relacionado;
  const rdoc = payload.complements[0].data[0].related_documents[0];
  const objetoImp = dr.objeto_imp_dr ?? "02";
  // ObjetoImpDR = 01 ⇒ el SAT prohíbe el nodo ImpuestosDR: se descartan los
  // impuestos del camino legacy (que declararían un IVA inexistente).
  const taxes = objetoImp === "01" ? [] : rdoc.taxes;
  return {
    uuid: rdoc.uuid,
    serie: rdoc.series ?? null,
    folio: rdoc.folio_number ?? null,
    moneda_dr: rdoc.currency,
    equivalencia_dr: rdoc.exchange ?? null,
    num_parcialidad: rdoc.installment,
    imp_saldo_ant: rdoc.last_balance,
    imp_pagado: rdoc.amount,
    imp_saldo_insoluto: dr.imp_saldo_insoluto,
    objeto_imp_dr: objetoImp,
    traslados: taxes
      .filter((t) => !t.withholding)
      .map((t) => ({ base: t.base, tasa: t.rate, factor: t.factor })),
    retenciones: taxes
      .filter((t) => t.withholding)
      .map((t) => ({ tipo: t.type, base: t.base, tasa: t.rate })),
  };
}

/**
 * Devuelve el payload listo para Facturapi con el complemento en XML crudo en
 * lugar del bloque estructurado. No muta el payload recibido.
 */
export function conComplementoXmlManual(
  payload: FacturapiRepPayload,
  ctx: PagoContext,
): Record<string, unknown> {
  const pago = payload.complements[0].data[0];
  const xml = buildPagoComplementoXml({
    fecha_pago: ctx.fecha_pago,
    forma_pago: normalizarFormaPago(ctx.forma_pago),
    moneda: ctx.moneda,
    tipo_cambio: ctx.tipo_cambio,
    monto: pago.related_documents[0].amount,
    num_operacion: ctx.numero_operacion ?? null,
    documentos: [doctoRelacionadoDesdePayload(payload, ctx)],
  });
  const { complements: _estructurado, ...resto } = payload;
  return { ...resto, complements: [{ type: COMPLEMENTO_XML_TYPE, data: xml }] };
}
