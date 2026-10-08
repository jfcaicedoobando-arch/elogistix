import { normalizarUsoCfdi } from "../_shared/usoCfdiEfectivo.ts";

/** Metadatos aditivos de una emisión exitosa. Sin XML, no afirmamos su uso efectivo. */
export function resultadoUsoCfdi(solicitado: string, usoXml: unknown) {
  const efectivo = normalizarUsoCfdi(usoXml);
  return {
    uso_cfdi_solicitado: solicitado,
    ...(efectivo ? { uso_cfdi_efectivo: efectivo, fuente_uso_cfdi: "xml" as const } : {}),
  };
}
