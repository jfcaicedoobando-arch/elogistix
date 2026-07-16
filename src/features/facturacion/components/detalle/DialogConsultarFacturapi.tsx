/**
 * DialogConsultarFacturapi — muestra un diagnóstico lado-a-lado del estado
 * de la factura en FacturApi vs. en Libre Carga. Útil cuando el SAT rechaza
 * la cancelación pero el portal FacturApi la marca como válida.
 */
import { useEffect } from "react";
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConsultarFacturapi } from "@/features/facturacion/hooks/useConsultarFacturapi";
import { DialogConsultarFacturapiResult } from "./DialogConsultarFacturapiResult";

interface Props {
  facturaId: string | null;
  numero: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DialogConsultarFacturapi({ facturaId, numero, open, onOpenChange }: Props) {
  const { mutate, reset, data, isPending, isError, error } = useConsultarFacturapi(facturaId);

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

        {data && <DialogConsultarFacturapiResult data={data} facturaId={facturaId} />}

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
