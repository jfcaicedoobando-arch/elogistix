/**
 * Helper compartido para construir nombres de archivo descargables de CFDI
 * emitidos (facturas, notas de crédito y complementos de pago).
 *
 * Regla: `{Tipo}_{FolioSerie}_{Cliente}_{Fecha}.{ext}`
 *   - Segmentos vacíos (cliente o fecha nulos) se omiten sin dejar `__` dobles.
 *   - `Cliente` se slugifica: sin acentos, `[^A-Za-z0-9]→_`, máx 40 chars.
 *   - `Fecha` se normaliza a `YYYY-MM-DD` (UTC).
 *
 * Aislado de la edge function para poder testearlo con Deno y mantenerlo puro.
 */

export type CfdiTipoDoc = "Factura" | "NotaCredito" | "REP";

export interface BuildFilenameInput {
  tipo: CfdiTipoDoc;
  folioSerie: string | null | undefined;
  cliente: string | null | undefined;
  fecha: string | Date | null | undefined;
  ext: "pdf" | "xml";
}

/** Normaliza texto libre para usarlo en un nombre de archivo (safe FS). */
export function slugifyForFilename(input: string | null | undefined): string {
  const s = (input ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return s;
}

/** Convierte una fecha ISO/Date a `YYYY-MM-DD` UTC. Devuelve "" si es inválida. */
export function toFechaYmd(input: string | Date | null | undefined): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Construye el nombre final del archivo descargable. Encadena solo los
 * segmentos con contenido y aplica la extensión al final.
 */
export function buildFilename(input: BuildFilenameInput): string {
  const parts: string[] = [input.tipo];
  const folio = slugifyForFilename(input.folioSerie);
  if (folio) parts.push(folio);
  const cliente = slugifyForFilename(input.cliente);
  if (cliente) parts.push(cliente);
  const fecha = toFechaYmd(input.fecha);
  if (fecha) parts.push(fecha);
  return `${parts.join("_")}.${input.ext}`;
}
