/**
 * DialogConsultarFacturapi — muestra un diagnóstico lado-a-lado del estado
 * de la factura en FacturApi vs. en Libre Carga. Útil cuando el SAT rechaza
 * la cancelación pero el portal FacturApi la marca como válida.
 */
import { useEffect } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConsultarFacturapi } from "@/features/facturacion/hooks/useConsultarFacturapi";

interface Props {
  facturaId: string | null;
  numero: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function fmtStatus(v: string | null | undefined): string {
  if (!v) return "—";
  return v;
}

export function DialogConsultarFacturapi({ facturaId, numero, open, onOpenChange }: Props) {
  const mutation = useConsultarFacturapi(facturaId);
  const { mutate, reset, data, isPending, isError, error } = mutation;

  // Dispara la consulta al abrir; limpia al cerrar.
  useEffect(() => {
    if (open && facturaId) mutate();
    if (!open) reset();
  }, [open, facturaId, mutate, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Estatus en FacturApi · {numero}</DialogTitle>
          <DialogDescription>
            Consulta en vivo lo que FacturApi/SAT reportan hoy. Si hay diferencias con la base de datos, se reconcilian automáticamente.
          </DialogDescription>
        </DialogHeader>

        {isPending && (
          <div className="flex items-center gap-2 py-8 text-muted-foreground justify-center">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Consultando FacturApi…
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error?.message ?? "Error al consultar."}</AlertDescription>
          </Alert>
        )}

        {data && (
          <div className="space-y-4">
            {data.reconciliada && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Se detectó divergencia y la factura local se reconcilió con FacturApi.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase">En FacturApi</div>
                <Row label="status" value={fmtStatus(data.remoto.status)} />
                <Row label="cancellation_status" value={fmtStatus(data.remoto.cancellation_status)} />
                <Row label="canceled_at" value={data.remoto.canceled_at ?? "—"} />
                <Row label="UUID" value={data.remoto.uuid ?? "—"} mono />
                <Row label="Folio" value={data.remoto.folio ? `${data.remoto.serie ?? ""}${data.remoto.folio}` : "—"} />
              </div>
              <div className="rounded-lg border p-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase">En Libre Carga</div>
                <Row label="estado" value={fmtStatus(data.local.estado)} />
                <Row label="cancellation_status" value={fmtStatus(data.local.cancellation_status)} />
                <Row label="UUID" value={data.local.uuid_fiscal ?? "—"} mono />
              </div>
            </div>

            {data.divergencias.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-1">Divergencias detectadas:</div>
                  <ul className="list-disc ml-4 text-sm space-y-1">
                    {data.divergencias.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {data.remoto.related_documents.length > 0 && (
              <div className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Documentos relacionados ({data.remoto.related_documents.length})
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Si el SAT rechaza la cancelación, revisa que estos documentos ya estén cancelados también.
                </p>
                <ul className="text-sm space-y-1">
                  {data.remoto.related_documents.map((doc, idx) => (
                    <li key={idx} className="flex items-center gap-2 flex-wrap">
                      {doc.relationship && <Badge variant="outline">{doc.relationship}</Badge>}
                      {doc.folio && <span>{doc.serie ?? ""}{doc.folio}</span>}
                      {doc.uuid && <span className="text-xs font-mono text-muted-foreground">{doc.uuid}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.divergencias.length === 0 && !data.reconciliada && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  El estado local coincide con lo que FacturApi reporta.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isPending || !facturaId}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Volver a consultar
          </Button>
          {data?.remoto.uuid && (
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://www.facturapi.io/dashboard/invoices?q=${encodeURIComponent(data.remoto.uuid)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-1" /> Abrir en FacturApi
              </a>
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs truncate max-w-[60%]" : "font-medium"}>{value}</span>
    </div>
  );
}
