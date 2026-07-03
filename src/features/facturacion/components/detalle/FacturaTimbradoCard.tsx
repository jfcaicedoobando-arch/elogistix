/**
 * FacturaTimbradoCard — datos post-timbrado (UUID, folio, serie asignada,
 * fecha de emisión) con botón para copiar el UUID. Se muestra solo cuando
 * la factura ya está timbrada (`uuid_fiscal` no nulo).
 */
import { toast } from "sonner";
import { Copy, FileCheck2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { formatDate } from "@/lib/formatters";

interface Props {
  uuidFiscal: string;
  folioFiscal: number | null;
  serie: string | null;
  fechaEmision: string | null;
}

export function FacturaTimbradoCard({ uuidFiscal, folioFiscal, serie, fechaEmision }: Props) {
  const copiarUuid = async () => {
    try {
      await navigator.clipboard.writeText(uuidFiscal);
      toast.success("UUID copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-success" /> Timbrado fiscal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="md:col-span-2 min-w-0">
            <p className="text-xs text-muted-foreground">UUID fiscal</p>
            <div className="flex items-center gap-1">
              <p className="font-mono text-xs truncate">{uuidFiscal}</p>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copiarUuid}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Folio</p>
            <p className="font-mono">{folioFiscal ?? "—"}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Serie</p>
            <p className="font-mono">{serie || "—"}</p>
          </div>
          <div className="min-w-0 md:col-span-2">
            <p className="text-xs text-muted-foreground">Fecha de emisión</p>
            <p className="font-medium">{fechaEmision ? formatDate(fechaEmision) : "—"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
