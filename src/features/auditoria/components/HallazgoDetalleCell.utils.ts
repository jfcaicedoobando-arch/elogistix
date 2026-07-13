/**
 * Utilidades puras de `HallazgoDetalleCell`. Se extrajeron a un archivo aparte
 * para que el componente cumpla `react-refresh/only-export-components`.
 */
import type { HallazgoAuditoria } from "@/features/auditoria/types";

export type HallazgoDetalle = Pick<HallazgoAuditoria, "detalle" | "documentos_faltantes" | "regla">;

const DOCUMENT_RULES = new Set<HallazgoAuditoria["regla"]>([
  "docs_faltantes",
  "docs_pendientes_avanzado",
]);

export function normalizeDocName(doc: string): string {
  return doc.trim().toLocaleLowerCase("es-MX");
}

function uniqueDocuments(docs: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const doc of docs ?? []) {
    const label = doc.trim();
    const key = normalizeDocName(label);
    if (!label || seen.has(key)) continue;
    seen.add(key);
    unique.push(label);
  }

  return unique;
}

function suffixRepeatsDocuments(suffix: string, documentos: string[]): boolean {
  const suffixDocs = suffix.split(",").map((doc) => doc.trim()).filter(Boolean);
  if (suffixDocs.length === 0) return false;

  const docSet = new Set(documentos.map(normalizeDocName));
  return suffixDocs.every((doc) => docSet.has(normalizeDocName(doc)));
}

export function getHallazgoDetalleParts(hallazgo: HallazgoDetalle) {
  const documentos = uniqueDocuments(hallazgo.documentos_faltantes);
  const detalle = hallazgo.detalle.trim();
  const colonIndex = detalle.indexOf(":");

  if (documentos.length === 0 || colonIndex === -1 || !DOCUMENT_RULES.has(hallazgo.regla)) {
    return { detalle, documentos };
  }

  const suffix = detalle.slice(colonIndex + 1).trim();
  if (!suffixRepeatsDocuments(suffix, documentos)) {
    return { detalle, documentos };
  }

  return { detalle: detalle.slice(0, colonIndex + 1), documentos };
}
