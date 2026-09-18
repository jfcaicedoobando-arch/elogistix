/**
 * Generador del XML del Complemento de Pagos 2.0 (`pago20:Pagos`).
 *
 * Se usa SÓLO cuando la factura relacionada tiene renglones "No objeto de
 * impuesto" (SAT ObjetoImp 01): la vía estructurada de Facturapi no expone
 * `ObjetoImpDR`, y declarar esos renglones como "Exento" sería un dato fiscal
 * falso. Facturapi acepta el XML del complemento en el nodo `complements`.
 *
 * Nada se recalcula aquí: bases, tasas y prorrateos llegan ya resueltos por
 * `helpers.ts · buildTaxesDr` (mismo redondeo a dos decimales).
 */
import {
  doctoRelacionadoXml,
  n2,
  nDec,
  totalesVacios,
  xmlAttr,
  type DoctoRelacionadoXml,
  type TotalesAcumulados,
} from "./pagoXmlDr.ts";

export type { DoctoRelacionadoXml, RetencionXml, TrasladoXml } from "./pagoXmlDr.ts";

export interface PagoXmlInput {
  /** Fecha/hora del pago (ISO). Si viene sólo la fecha se completa a mediodía. */
  fecha_pago: string;
  /** Clave SAT c_FormaPago ya normalizada (01, 03, 28, 99...). */
  forma_pago: string;
  moneda: string;
  /** TipoCambioP: pesos por unidad de la moneda del pago (1 si MXN). */
  tipo_cambio: number;
  monto: number;
  num_operacion?: string | null;
  documentos: DoctoRelacionadoXml[];
}

const NS_PAGO = "http://www.sat.gob.mx/Pagos20";
const NS_XSI = "http://www.w3.org/2001/XMLSchema-instance";
const SCHEMA_LOCATION = `${NS_PAGO} http://www.sat.gob.mx/sitio_internet/cfd/Pagos/Pagos20.xsd`;

/**
 * `FechaPago` del SAT: `yyyy-MM-ddTHH:mm:ss`, sin zona horaria ni milisegundos.
 * Una fecha sin hora se ancla a las 12:00:00 para que no se corra de día al
 * interpretarse en otra zona.
 */
export function fechaPagoSat(valor: string): string {
  const texto = String(valor ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return `${texto}T12:00:00`;
  const m = texto.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/);
  if (m) return `${m[1]}T${m[2].length === 5 ? `${m[2]}:00` : m[2]}`;
  const d = new Date(texto);
  if (Number.isNaN(d.getTime())) return texto;
  return d.toISOString().slice(0, 19);
}

function atributoTotal(nombre: string, valor: number): string {
  return valor > 0 ? ` ${nombre}="${n2(valor)}"` : "";
}

/**
 * Nodo `Totales` (en MXN). Sólo se declaran los atributos con importe: el SAT
 * prohíbe enviar un total en ceros para un impuesto que no existe.
 */
function totalesXml(t: TotalesAcumulados, montoTotalPagos: number): string {
  const partes = [
    atributoTotal("TotalRetencionesIVA", t.retIva),
    atributoTotal("TotalRetencionesISR", t.retIsr),
    atributoTotal("TotalTrasladosBaseIVA16", t.base16),
    atributoTotal("TotalTrasladosImpuestoIVA16", t.imp16),
    atributoTotal("TotalTrasladosBaseIVA8", t.base8),
    atributoTotal("TotalTrasladosImpuestoIVA8", t.imp8),
    atributoTotal("TotalTrasladosBaseIVA0", t.base0),
    atributoTotal("TotalTrasladosImpuestoIVA0", t.imp0),
    atributoTotal("TotalTrasladosBaseIVAExento", t.baseExento),
  ].join("");
  return `<pago20:Totales${partes} MontoTotalPagos="${n2(montoTotalPagos)}"/>`;
}

/** Construye el XML completo del complemento de pago para UN pago. */
export function buildPagoComplementoXml(input: PagoXmlInput): string {
  const totales = totalesVacios();
  const tipoCambioP = input.moneda === "MXN" ? 1 : Number(input.tipo_cambio ?? 0);
  const documentos = input.documentos
    .map((d) => doctoRelacionadoXml(d, tipoCambioP, totales))
    .join("");

  const pagoAttrs = [
    `FechaPago="${xmlAttr(fechaPagoSat(input.fecha_pago))}"`,
    `FormaDePagoP="${xmlAttr(input.forma_pago)}"`,
    `MonedaP="${xmlAttr(input.moneda)}"`,
    input.moneda !== "MXN" && tipoCambioP > 0 ? `TipoCambioP="${nDec(tipoCambioP, 6)}"` : "",
    `Monto="${n2(input.monto)}"`,
    input.num_operacion ? `NumOperacion="${xmlAttr(String(input.num_operacion))}"` : "",
  ].filter((a) => a !== "").join(" ");

  const montoTotalPagos = input.monto * (tipoCambioP > 0 ? tipoCambioP : 1);

  return (
    `<pago20:Pagos xmlns:pago20="${NS_PAGO}" xmlns:xsi="${NS_XSI}" ` +
    `xsi:schemaLocation="${SCHEMA_LOCATION}" Version="2.0">` +
    totalesXml(totales, montoTotalPagos) +
    `<pago20:Pago ${pagoAttrs}>${documentos}</pago20:Pago>` +
    `</pago20:Pagos>`
  );
}
