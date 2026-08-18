/**
 * Lista de documentos del expediente visible en el tracking público:
 * separa los recibidos de los que faltan y explica qué hacer con los faltantes.
 * No expone archivos ni notas internas.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CircleDashed, FileText } from "lucide-react";
import type { TrackingPublicoDocumento } from "@/features/embarques/services/tracking";
import { AvisoAccionable } from "@/components/shared/states/AvisoAccionable";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

interface Props {
  documentos: TrackingPublicoDocumento[];
}

function Fila({ doc }: { doc: TrackingPublicoDocumento }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0">
      <span className="flex items-center gap-2 text-sm text-foreground">
        {doc.recibido ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <CircleDashed className="h-4 w-4 text-muted-foreground" />
        )}
        {doc.nombre}
      </span>
      <Badge variant={doc.recibido ? "default" : "outline"}>
        {doc.recibido ? doc.estado : doc.requerido ? "Falta" : "Pendiente"}
      </Badge>
    </li>
  );
}

export function TrackingPublicoDocumentos({ documentos }: Props) {
  const recibidos = documentos.filter((d) => d.recibido);
  const faltantes = documentos.filter((d) => !d.recibido);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Documentos del expediente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {documentos.length === 0 ? (
          <AvisoAccionable
            icon={<FileText className="h-5 w-5" />}
            titulo="Todavía no se requieren documentos"
            descripcion="En la etapa actual de tu embarque no hay documentos por entregar."
            pasos={[
              "Cuando la etapa lo requiera, los documentos aparecerán aquí.",
              "Si necesitas adelantar algún archivo, envíalo a tu ejecutivo de cuenta.",
            ]}
            className="border-dashed"
          />
        ) : (
          <>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Recibidos ({recibidos.length})
              </p>
              {recibidos.length === 0 ? (
                <EmptyStateInline icon={CheckCircle2} message="Aún no recibimos ningún documento." className="py-4" />
              ) : (
                <ul>{recibidos.map((d) => <Fila key={d.nombre} doc={d} />)}</ul>
              )}
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Faltantes ({faltantes.length})
              </p>
              {faltantes.length === 0 ? (
                <EmptyStateInline
                  icon={CircleDashed}
                  message="Tenemos completo el expediente de esta etapa."
                  className="py-4"
                />
              ) : (
                <>
                  <ul>{faltantes.map((d) => <Fila key={d.nombre} doc={d} />)}</ul>
                  <p className="text-xs text-muted-foreground pt-2">
                    Envía los documentos faltantes a tu ejecutivo de cuenta para no retrasar el
                    despacho de tu carga.
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
