import { Badge } from "@/components/ui/badge";
import type { HallazgoAuditoria } from "@/features/auditoria/types";

type HallazgoDetalle = Pick<HallazgoAuditoria, "detalle" | "documentos_faltantes" | "regla">;

const DOCUMENT_RULES = new Set<HallazgoAuditoria["regla"]>([
  "docs_faltantes",
  "docs_pendientes_avanzado",
]);

function normalizeDocName(doc: string): string {
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

export function HallazgoDetalleCell({ hallazgo }: { hallazgo: HallazgoDetalle }) {
  const { detalle, documentos } = getHallazgoDetalleParts(hallazgo);

  return (
    <>
      <div>{detalle}</div>
      {documentos.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {documentos.map((doc) => (
            <Badge key={normalizeDocName(doc)} variant="secondary" className="text-2xs font-normal">
              {doc}
            </Badge>
          ))}
        </div>
      )}
    </>
  );
}