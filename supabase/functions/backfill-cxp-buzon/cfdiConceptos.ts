/**
 * Parser mínimo de conceptos CFDI 4.0 para el backfill del buzón CxP.
 *
 * Se mantiene dentro de la carpeta de la función (los imports fuera de
 * `_shared/` no se despliegan). Regex defensiva: el CFDI es plano y no se
 * ejecutan DOCTYPE/entities, así que no hay superficie XXE.
 */

export interface ConceptoCfdi {
  descripcion: string;
  cantidad: number;
  clave_unidad: string;
  importe: number;
  iva: number;
  ieps: number;
}

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? decodeXmlEntities(m[1]).trim() : "";
}

function num(s: string): number {
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function conceptoBlocks(xml: string): string[] {
  const re =
    /<(?:[A-Za-z0-9]+:)?Concepto\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:[A-Za-z0-9]+:)?Concepto\s*>)/gi;
  return xml.match(re) ?? [];
}

function openingTag(block: string): string {
  const m = block.match(/<(?:[A-Za-z0-9]+:)?Concepto\b[^>]*?\/?>/i);
  return m ? m[0] : block;
}

function impuestosDe(block: string): { iva: number; ieps: number } {
  let iva = 0;
  let ieps = 0;
  const traslados = block.match(/<(?:[A-Za-z0-9]+:)?Traslado\b[^>]*\/?>/gi) ?? [];
  for (const t of traslados) {
    const code = attr(t, "Impuesto");
    const importe = num(attr(t, "Importe"));
    if (code === "002") iva += importe;
    else if (code === "003") ieps += importe;
  }
  return { iva, ieps };
}

/** Extrae los conceptos (líneas) del XML. Devuelve [] si no hay ninguno. */
export function parseConceptosCfdi(xml: string): ConceptoCfdi[] {
  return conceptoBlocks(xml).map((block) => {
    const tag = openingTag(block);
    const { iva, ieps } = impuestosDe(block);
    return {
      descripcion: attr(tag, "Descripcion") || "(Sin descripción)",
      cantidad: num(attr(tag, "Cantidad")) || 1,
      clave_unidad: attr(tag, "ClaveUnidad"),
      importe: num(attr(tag, "Importe")),
      iva,
      ieps,
    };
  });
}
