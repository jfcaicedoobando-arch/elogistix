/**
 * N50 (Ola 4): validación de contenido real de CFDI y construcción de paths
 * con prefijo de slot. Extraído de cfdiStorage.ts para mantener ≤200 líneas.
 */
import { sanitizeFileName } from "@/lib/storage";
import { newRequestId } from "@/lib/idempotency";

export type TipoAdjuntoCfdi = "XML" | "PDF";

export function contentTypeFor(tipo: TipoAdjuntoCfdi): string {
  return tipo === "XML" ? "application/xml" : "application/pdf";
}

/**
 * N50 (Ola 4): valida que el contenido real del archivo corresponda al slot
 * (extensión + magic bytes). Antes se forzaba el contentType sin verificar:
 * un XML renombrado .pdf (o viceversa) corrompía el expediente fiscal.
 */
export async function validarContenidoCfdi(tipo: TipoAdjuntoCfdi, file: File): Promise<void> {
  const nombre = file.name.toLowerCase();
  const extOk = tipo === "XML" ? nombre.endsWith(".xml") : nombre.endsWith(".pdf");
  if (!extOk) {
    throw new Error(
      `El archivo "${file.name}" no tiene extensión .${tipo.toLowerCase()}; se esperaba un ${tipo} para este campo.`,
    );
  }
  const head = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  if (tipo === "PDF") {
    const esPdf =
      head.length >= 5 &&
      head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d;
    if (!esPdf) {
      throw new Error(`El archivo "${file.name}" no es un PDF válido (faltan los bytes %PDF).`);
    }
  } else {
    const texto = new TextDecoder().decode(head).replace(/^\uFEFF/, "").trimStart();
    if (!texto.startsWith("<")) {
      throw new Error(`El archivo "${file.name}" no es un XML válido (no inicia con '<').`);
    }
  }
}

/**
 * Cada subida usa una ruta nueva, incluso al reemplazar un archivo del mismo nombre.
 */
export function pathCfdi(base: string, tipo: TipoAdjuntoCfdi, nombreArchivo: string): string {
  return `${base}/${tipo.toLowerCase()}-${newRequestId()}-${sanitizeFileName(nombreArchivo)}`;
}

