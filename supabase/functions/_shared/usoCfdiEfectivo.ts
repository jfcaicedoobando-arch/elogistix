/** Sólo el valor comunicado por el comprobante; nunca sustituye el solicitado por una suposición. */
export function normalizarUsoCfdi(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const uso = value.trim().toUpperCase();
  return /^(G0[1-3]|I0[1-8]|D(0[1-9]|10)|S01|P01|CP01|CN01)$/.test(uso) ? uso : null;
}

export function patchUsoCfdiEfectivo(invoice: { use?: unknown }): Record<string, string> {
  const uso = normalizarUsoCfdi(invoice.use);
  return uso ? { uso_cfdi: uso } : {};
}

export function resolverUsoCfdiEfectivo(usoXml: unknown, usoRespuesta: unknown) {
  const xml = normalizarUsoCfdi(usoXml);
  if (xml) return { uso: xml, fuente: "xml" };
  const respuesta = normalizarUsoCfdi(usoRespuesta);
  return { uso: respuesta, fuente: respuesta ? "respuesta" : null };
}

function atributo(xml: string, nodo: string, nombre: string): string | null {
  const tag = new RegExp(`<(?:[\\w.-]+:)?${nodo}\\b[^>]*>`, "i").exec(xml)?.[0];
  if (!tag) return null;
  return new RegExp(`\\b${nombre}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(tag)?.[2] ?? null;
}

/** El XML sólo es fuente efectiva cuando pertenece al UUID que se está persistiendo. */
export function usoCfdiDesdeXml(xml: string, uuidEsperado: string): string | null {
  const uuid = atributo(xml, "TimbreFiscalDigital", "UUID");
  if (!uuid || uuid.trim().toUpperCase() !== uuidEsperado.trim().toUpperCase()) return null;
  return normalizarUsoCfdi(atributo(xml, "Receptor", "UsoCFDI"));
}
