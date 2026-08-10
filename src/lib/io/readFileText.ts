/**
 * N34 (Ola 4): lee un archivo de texto tolerando Windows-1252.
 * Los CSV de Excel y de BBVA Net Cash en Windows es-MX suelen venir en
 * Windows-1252; `file.text()` los decodifica como UTF-8 y los acentos/ñ
 * llegan como mojibake (DESCRIPCIÓN → DESCRIPCIÃ"N) que rompe la detección
 * de encabezados o se guarda corrupto silenciosamente.
 *
 * Estrategia: UTF-8 estricto (fatal) primero — cualquier byte acentuado de
 * Windows-1252 es una secuencia UTF-8 inválida y lanza → fallback a
 * windows-1252. ASCII puro decodifica idéntico en ambos caminos.
 */
export async function leerArchivoTexto(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
