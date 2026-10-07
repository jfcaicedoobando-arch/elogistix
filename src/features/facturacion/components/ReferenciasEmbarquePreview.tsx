/** Vista previa informativa; el servidor vuelve a resolver referencias al timbrar. */
import { FileBadge2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReferenciasEmbarqueFactura } from "../hooks/useReferenciasEmbarqueFactura";
import { formatearPrefijoReferencias, type ConceptoReferenciaPreview, type FacturaReferenciasInput } from "../domain/referenciasFacturaPreview";

interface Props { factura: FacturaReferenciasInput | null | undefined }

function ReferenciaConcepto({ concepto }: { concepto: ConceptoReferenciaPreview }) {
  const prefijo = formatearPrefijoReferencias(concepto.referencias);
  const sinReferencia = concepto.estado === "sin_origen"
    ? "Sin embarque de origen: este concepto no hereda referencias de otros conceptos."
    : "Sin referencias de expediente o BL registradas.";
  return (
    <li className="space-y-1 border-t border-primary/10 pt-2 break-words">
      <div className="font-medium">{concepto.descripcion}</div>
      {concepto.estado === "no_disponible" ? (
        <p className="text-muted-foreground">Origen no disponible. No se pudo verificar su referencia.</p>
      ) : prefijo ? (
        <p className="font-mono text-label">{prefijo.trim()}</p>
      ) : <p className="text-muted-foreground">{sinReferencia}</p>}
    </li>
  );
}

export function ReferenciasEmbarquePreview({ factura }: Props) {
  const query = useReferenciasEmbarqueFactura(factura);
  return (
    <section aria-label="Referencias por concepto" className="rounded-md border border-primary/20 bg-primary/5 p-3 text-body-sm space-y-2">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <FileBadge2 className="h-3.5 w-3.5" aria-hidden />
        Referencias por concepto
      </div>
      {!query.scopeValido ? (
        <p>No se pudo verificar la organización de la factura. Las referencias no están disponibles.</p>
      ) : query.isError ? (
        <div role="alert">
          <p>No se pudieron verificar las referencias. Reintenta la consulta antes de timbrar.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => { void query.refetch(); }}>Reintentar referencias</Button>
        </div>
      ) : query.isFetching || !query.data ? (
        <p role="status">Consultando referencias de los conceptos…</p>
      ) : (
        <>
          <p className="text-muted-foreground">
            Vista previa de expediente, BL Master y BL House. Al timbrar se consultan de nuevo y se incluyen según el origen de cada concepto en el CFDI y en el bloque de referencias del PDF.
          </p>
          {query.data.modo === "cabecera_legada" && query.data.conceptos.length > 0 && (
            <p className="text-muted-foreground">Ningún concepto tiene embarque de origen. Se aplica la compatibilidad con las referencias de cabecera de esta factura.</p>
          )}
          {query.data.conceptos.length === 0 ? (
            <p>No hay conceptos vigentes disponibles para revisar.</p>
          ) : (
            <ul className="space-y-2">
              {query.data.conceptos.map((concepto) => <ReferenciaConcepto key={concepto.id} concepto={concepto} />)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
