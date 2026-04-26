/**
 * Utilidades para construir paths seguros para Supabase Storage.
 *
 * Supabase Storage rechaza keys con caracteres no-ASCII, espacios, paréntesis
 * y otros símbolos. Estas funciones normalizan strings a un subconjunto seguro
 * preservando legibilidad y la extensión del archivo.
 */

const MAX_SEGMENT_LEN = 80;

/**
 * Sanitiza un valor (nombre de carpeta, archivo o segmento) para usarse como
 * key en Supabase Storage.
 *
 * - Normaliza Unicode (NFD) y elimina diacríticos (acentos).
 * - Reemplaza cualquier carácter fuera de [A-Za-z0-9._-] por "_".
 * - Colapsa múltiples "_" consecutivos.
 * - Recorta "_" al inicio/final.
 * - Limita la longitud a `maxLen` caracteres.
 *
 * Si el resultado quedaría vacío, retorna "_".
 */
export function sanitizeStorageKey(value: string, maxLen = MAX_SEGMENT_LEN): string {
  if (!value) return "_";
  const sinAcentos = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const ascii = sinAcentos.replace(/[^A-Za-z0-9._-]/g, "_");
  const colapsado = ascii.replace(/_{2,}/g, "_").replace(/^_+|_+$/g, "");
  const recortado = colapsado.slice(0, maxLen);
  return recortado || "_";
}

/**
 * Sanitiza un nombre de archivo preservando su extensión final.
 * Ej: `172-04513806_提单.pdf` → `172-04513806_.pdf`
 *     `archivo!@#.docx`       → `archivo_.docx`
 *     `documento.tar.gz`      → `documento.tar.gz` (solo conserva la última extensión como tal)
 */
export function sanitizeFileName(fileName: string, maxLen = MAX_SEGMENT_LEN): string {
  if (!fileName) return "_";
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return sanitizeStorageKey(fileName, maxLen);
  }
  const base = fileName.slice(0, lastDot);
  const ext = fileName.slice(lastDot + 1);
  const baseSano = sanitizeStorageKey(base, Math.max(1, maxLen - ext.length - 1));
  const extSano = sanitizeStorageKey(ext, 16);
  return `${baseSano}.${extSano}`;
}

/**
 * Construye el path completo para un documento de embarque, con todos los
 * segmentos sanitizados.
 *
 * Resultado: `embarques/{expediente}/{docNombre}/{timestamp}_{fileName}`
 */
export function buildEmbarqueDocPath(
  expediente: string,
  docNombre: string,
  fileName: string,
): string {
  const exp = sanitizeStorageKey(expediente);
  const doc = sanitizeStorageKey(docNombre);
  const archivo = sanitizeFileName(fileName);
  return `embarques/${exp}/${doc}/${Date.now()}_${archivo}`;
}
