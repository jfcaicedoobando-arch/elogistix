// Parser puro para CFDI 4.0. Extrae atributos clave del XML sin AI.
// Se usa regex defensiva — XML CFDI es plano y predecible, y evitamos
// dependencias DOM en Deno. NO ejecuta DOCTYPE/entities (no hay superficie XXE).

export interface CfdiConcepto {
  descripcion: string;
  cantidad: number;
  clave_unidad: string;
  importe: number;
  iva: number;
  ieps: number;
}

export interface CfdiParsed {
  uuid: string;
  serie: string;
  folio: string;
  fecha: string;            // ISO YYYY-MM-DD
  moneda: string;           // MXN / USD / EUR
  tipo_cambio: number | null;  // FIX-11: null cuando la moneda es USD/EUR y el CFDI no trae TC válido.
  subtotal: number;
  total: number;
  iva_trasladado: number;
  ieps_trasladado: number;  // Clave SAT 003 — aplica en fletes, maniobras, etc.
  retenciones: number;
  tipo_comprobante: string; // I=Ingreso, E=Egreso, T=Traslado, N=Nómina, P=Pago
  emisor: { rfc: string; nombre: string; regimen: string };
  receptor: { rfc: string; nombre: string };
  conceptos: CfdiConcepto[];
}

const ATTR = (name: string) => new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i");

/**
 * v13.320.62 — Decodifica entidades XML en valores de atributo.
 *
 * Bug real: un RFC como `AL&0807074L5` viaja en el CFDI como
 * `Rfc="AL&amp;0807074L5"`. Antes guardábamos el literal `AL&amp;0807074L5`,
 * lo que rompía la consulta de estatus al SAT (devolvía "Error").
 * Aplica a RFC, Nombre, Descripcion, Serie, Folio y cualquier texto.
 */
export function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // `&amp;` va al final para no re-decodificar secuencias generadas arriba.
    .replace(/&amp;/g, "&");
}

function attr(tag: string, name: string): string {
  const m = tag.match(ATTR(name));
  return m ? decodeXmlEntities(m[1]).trim() : "";
}

/**
 * FIX-R2-28: antes silenciaba valores no numéricos devolviendo 0, lo que
 * ocultaba XML corruptos. Ahora sólo el string vacío se trata como "atributo
 * ausente"; cualquier otro valor no parseable lanza para dejar rastro.
 * TODO: migrar el parser regex a un parser DOM real (deno-dom) para robustez.
 */
function num(s: string): number {
  if (s === "" || s == null) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) {
    throw new Error(`LC_XML_NUMERO_INVALIDO: valor no numérico "${s}"`);
  }
  return n;
}


function findTag(xml: string, localName: string): string | null {
  // Acepta prefijo (cfdi:, tfd:) o sin prefijo. Toma el primer match.
  const re = new RegExp(`<(?:[A-Za-z0-9]+:)?${localName}\\b[^>]*/?>`, "i");
  const m = xml.match(re);
  return m ? m[0] : null;
}

function findAllTags(xml: string, localName: string): string[] {
  const re = new RegExp(`<(?:[A-Za-z0-9]+:)?${localName}\\b[^>]*/?>`, "gi");
  return xml.match(re) ?? [];
}

/**
 * Suma IVA (002) e IEPS (003) recorriendo los `<Traslado>` del XML.
 * Estrategia por orden de preferencia (para no duplicar):
 *   1. Traslados del bloque raíz `<Impuestos><Traslados>...` (fuente de verdad
 *      cuando existen — SAT lo emite así en CFDI 4.0 con desglose).
 *   2. Suma de Traslados por concepto (cuando el raíz es self-closing o falta).
 *   3. Fallback al atributo `TotalImpuestosTrasladados` del raíz (sólo como IVA,
 *      no permite distinguir IEPS — se pierde el desglose pero no la magnitud).
 */
function extractImpuestos(xml: string): { iva: number; ieps: number; retenciones: number } {
  let totRet = 0;
  const allImp = findAllTags(xml, "Impuestos");
  const rootImp = allImp.find(
    (t) => /TotalImpuestosTrasladados|TotalImpuestosRetenidos/i.test(t),
  );

  // 1) Intentar traslados del bloque raíz (si es no self-closing y tiene Traslados).
  const trasladosRoot = rootImp ? extractTrasladosDe(xml, rootImp) : [];
  let iva = 0;
  let ieps = 0;
  if (trasladosRoot.length > 0) {
    for (const t of trasladosRoot) {
      const impCode = attr(t, "Impuesto");
      const importe = num(attr(t, "Importe"));
      if (impCode === "002") iva += importe;
      else if (impCode === "003") ieps += importe;
    }
  } else {
    // 2) Sumar traslados por concepto.
    for (const c of findConceptoBlocks(xml)) {
      const imp = extractImpuestosConcepto(c);
      iva += imp.iva;
      ieps += imp.ieps;
    }
    // 3) Fallback: si tampoco hay traslados por concepto, usar total del raíz como IVA.
    if (iva === 0 && ieps === 0 && rootImp) {
      iva = num(attr(rootImp, "TotalImpuestosTrasladados"));
    }
  }

  // Retenciones: preferir total del raíz si existe.
  if (rootImp) {
    totRet = num(attr(rootImp, "TotalImpuestosRetenidos"));
  } else {
    for (const r of findAllTags(xml, "Retencion")) {
      totRet += num(attr(r, "Importe"));
    }
  }

  return { iva, ieps, retenciones: totRet };
}

/**
 * Aísla los <Traslado> que cuelgan del <Impuestos> raíz (no los de Concepto).
 * Devuelve [] si el tag raíz es self-closing o no tiene bloque de Traslados.
 */
function extractTrasladosDe(xml: string, rootImpTag: string): string[] {
  // Si es self-closing no tiene hijos.
  if (/\/>\s*$/.test(rootImpTag)) return [];
  const idx = xml.indexOf(rootImpTag);
  if (idx < 0) return [];
  const closeRe = /<\/(?:[A-Za-z0-9]+:)?Impuestos\s*>/i;
  const rest = xml.slice(idx + rootImpTag.length);
  const closeMatch = rest.match(closeRe);
  if (!closeMatch || closeMatch.index === undefined) return [];
  const bloque = rest.slice(0, closeMatch.index);
  return findAllTags(bloque, "Traslado");
}

/** Extrae IVA/IEPS trasladados de un <Concepto> individual. */
function extractImpuestosConcepto(conceptoBlock: string): { iva: number; ieps: number } {
  let iva = 0;
  let ieps = 0;
  for (const t of findAllTags(conceptoBlock, "Traslado")) {
    const impCode = attr(t, "Impuesto");
    const importe = num(attr(t, "Importe"));
    if (impCode === "002") iva += importe;
    else if (impCode === "003") ieps += importe;
  }
  return { iva, ieps };
}

/** Encuentra bloques completos <Concepto>...</Concepto> preservando su contenido. */
function findConceptoBlocks(xml: string): string[] {
  const re = /<(?:[A-Za-z0-9]+:)?Concepto\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:[A-Za-z0-9]+:)?Concepto\s*>)/gi;
  return xml.match(re) ?? [];
}

export function parseCfdi(xml: string): CfdiParsed {
  if (!xml || !xml.includes("Comprobante")) {
    throw new Error("XML no es un CFDI válido");
  }
  // Rechazar DOCTYPE para mitigar cualquier intento XXE aunque no usemos DOM.
  if (/<!DOCTYPE/i.test(xml)) {
    throw new Error("XML con DOCTYPE no permitido");
  }

  const comprobante = findTag(xml, "Comprobante");
  if (!comprobante) throw new Error("Falta elemento Comprobante");

  const version = attr(comprobante, "Version");
  if (!version.startsWith("4.")) {
    throw new Error(`Solo se acepta CFDI 4.0 (recibido: ${version || "desconocido"})`);
  }

  const tfd = findTag(xml, "TimbreFiscalDigital");
  const uuid = tfd ? attr(tfd, "UUID") : "";
  if (!uuid) throw new Error("CFDI sin timbre fiscal (UUID)");

  const emisor = findTag(xml, "Emisor") ?? "";
  const receptor = findTag(xml, "Receptor") ?? "";

  const { iva, ieps, retenciones } = extractImpuestos(xml);

  // Tope defensivo anti-DoS. Antes era 10, pero CFDIs reales de fletes marítimos
  // suelen desglosar 10-30 líneas (BAF, THC, DOC, VGM, etc.); truncar rompía el
  // cuadre subtotal↔conceptos en `validarCuadreCfdi`. 200 sigue siendo un tope
  // razonable: un CFDI 4.0 legítimo casi nunca los excede.
  const conceptos: CfdiConcepto[] = findConceptoBlocks(xml).slice(0, 200).map((c) => {
    const imp = extractImpuestosConcepto(c);
    const cantidadRaw = num(attr(c, "Cantidad"));
    const cantidad = cantidadRaw > 0 ? cantidadRaw : 1;
    // El atributo CFDI `Importe` es el TOTAL de la línea (Cantidad × ValorUnitario),
    // pero el sistema (y el trigger `_cxp_validar_aprobacion`) tratan `importe`
    // como UNITARIO y lo multiplican por la cantidad. Sin esta normalización una
    // línea con cantidad > 1 se contaba dos veces (LC_CXP_DESCUADRE).
    const importeLinea = num(attr(c, "Importe"));
    const valorUnitario = num(attr(c, "ValorUnitario"));
    const unitario = valorUnitario > 0
      ? valorUnitario
      : (cantidad > 0 ? importeLinea / cantidad : importeLinea);
    return {
      descripcion: attr(c, "Descripcion"),
      cantidad,
      clave_unidad: attr(c, "ClaveUnidad"),
      importe: Math.round(unitario * 1e6) / 1e6,
      iva: imp.iva,
      ieps: imp.ieps,
    };
  });


  const fechaRaw = attr(comprobante, "Fecha"); // 2025-03-14T10:22:01
  const fecha = fechaRaw.slice(0, 10);

  const monedaCfdi = attr(comprobante, "Moneda") || "MXN";
  const tcRaw = num(attr(comprobante, "TipoCambio"));
  // FIX-11: sólo colapsamos a 1 cuando la moneda es MXN. Para USD/EUR sin TC
  // válido devolvemos null: el caller decide si rechazar o pedir captura manual.
  const tcCfdi = monedaCfdi === "MXN" ? 1 : (Number.isFinite(tcRaw) && tcRaw > 0 ? tcRaw : null);

  return {
    uuid,
    serie: attr(comprobante, "Serie"),
    folio: attr(comprobante, "Folio"),
    fecha,
    moneda: monedaCfdi,
    tipo_cambio: tcCfdi,
    subtotal: num(attr(comprobante, "SubTotal")),
    total: num(attr(comprobante, "Total")),
    iva_trasladado: iva,
    ieps_trasladado: ieps,
    retenciones,
    tipo_comprobante: attr(comprobante, "TipoDeComprobante") || "I",
    emisor: {
      rfc: attr(emisor, "Rfc"),
      nombre: attr(emisor, "Nombre"),
      regimen: attr(emisor, "RegimenFiscal"),
    },
    receptor: {
      rfc: attr(receptor, "Rfc"),
      nombre: attr(receptor, "Nombre"),
    },
    conceptos,
  };
}
