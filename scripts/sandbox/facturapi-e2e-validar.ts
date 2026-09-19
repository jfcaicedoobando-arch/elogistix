/**
 * Validaciones del XML timbrado en la prueba Sandbox E2E (PPD + No objeto).
 * Sólo lectura de texto: no se usa ningún parser externo para no agregar
 * dependencias al repo. Cada regla devuelve un renglón legible para el reporte.
 */

export interface Resultado {
  ok: boolean;
  regla: string;
  detalle: string;
}

function regla(ok: boolean, nombre: string, detalle: string): Resultado {
  return { ok, regla: nombre, detalle };
}

function atributos(xml: string, nodo: string): string[] {
  const re = new RegExp(`<[a-zA-Z0-9]+:${nodo}\\b[^>]*>`, "g");
  return xml.match(re) ?? [];
}

function valorAtributo(tag: string, nombre: string): string | null {
  const m = tag.match(new RegExp(`${nombre}="([^"]*)"`));
  return m ? m[1] : null;
}

/** Factura I: MetodoPago=PPD y ambos ObjetoImp (02 gravado, 01 no objeto). */
export function validarFacturaPpdMixta(xml: string): Resultado[] {
  const comprobante = atributos(xml, "Comprobante")[0] ?? "";
  const conceptos = atributos(xml, "Concepto");
  const objetos = conceptos.map((c) => valorAtributo(c, "ObjetoImp"));
  return [
    regla(
      valorAtributo(comprobante, "MetodoPago") === "PPD",
      "factura.MetodoPago=PPD",
      `MetodoPago=${valorAtributo(comprobante, "MetodoPago")}`,
    ),
    regla(
      valorAtributo(comprobante, "FormaPago") === "99",
      "factura.FormaPago=99 (PPD sin pago recibido)",
      `FormaPago=${valorAtributo(comprobante, "FormaPago")}`,
    ),
    regla(objetos.includes("02"), "factura.concepto gravado ObjetoImp=02", `ObjetoImp=${objetos.join(",")}`),
    regla(objetos.includes("01"), "factura.concepto no objeto ObjetoImp=01", `ObjetoImp=${objetos.join(",")}`),
    regla(
      conceptos.filter((c) => valorAtributo(c, "ObjetoImp") === "01" && /<[a-zA-Z0-9]+:Impuestos/.test(c)).length === 0,
      "factura.no objeto sin nodo de impuestos",
      "el concepto 01 no declara traslados ni retenciones",
    ),
  ];
}

/** REP P: complemento de pagos con ObjetoImpDR correcto por documento. */
export function validarRepNoObjeto(xml: string, objetoImpEsperado: "01" | "02"): Resultado[] {
  const pagos = atributos(xml, "Pagos");
  const docs = atributos(xml, "DoctoRelacionado");
  const doc = docs[0] ?? "";
  const traslados = atributos(xml, "TrasladoDR");
  return [
    regla(pagos.length === 1, "rep.complemento pago20:Pagos presente", `nodos=${pagos.length}`),
    regla(docs.length >= 1, "rep.DoctoRelacionado presente", `documentos=${docs.length}`),
    regla(
      valorAtributo(doc, "MetodoDePagoDR") === "PPD",
      "rep.MetodoDePagoDR=PPD",
      `MetodoDePagoDR=${valorAtributo(doc, "MetodoDePagoDR")}`,
    ),
    regla(
      valorAtributo(doc, "ObjetoImpDR") === objetoImpEsperado,
      `rep.ObjetoImpDR=${objetoImpEsperado}`,
      `ObjetoImpDR=${valorAtributo(doc, "ObjetoImpDR")}`,
    ),
    regla(
      objetoImpEsperado === "01" ? traslados.length === 0 : traslados.length >= 1,
      "rep.traslados coherentes con el tratamiento",
      `TrasladoDR=${traslados.length}`,
    ),
  ];
}

export function imprimirReporte(titulo: string, resultados: Resultado[]): boolean {
  console.log(`\n== ${titulo}`);
  for (const r of resultados) {
    console.log(`${r.ok ? "PASA" : "FALLA"}  ${r.regla} — ${r.detalle}`);
  }
  return resultados.every((r) => r.ok);
}
