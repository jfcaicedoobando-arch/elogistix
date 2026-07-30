/**
 * Datos fiscales leídos del XML del CFDI antes de enviarlo al buzón.
 * Sirven para que el operador confirme que subió la factura correcta.
 */
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters/dates";
import type { CfdiXmlMeta } from "@/lib/domain/cfdiXmlMeta";

interface Props {
  meta: CfdiXmlMeta;
  metaUtil: boolean;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="truncate text-sm font-medium">{valor}</p>
    </div>
  );
}

export function CfdiMetaPreview({ meta, metaUtil }: Props) {
  if (!metaUtil) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
        <p className="text-xs text-muted-foreground">
          No pudimos leer el UUID ni el RFC del XML. Puedes enviarlo igual: contabilidad lo revisará al capturarlo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <p className="text-sm font-medium">Datos leídos del CFDI</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Dato etiqueta="Folio" valor={meta.folioSerie ?? "Sin folio"} />
        <Dato
          etiqueta="Total"
          valor={meta.total == null ? "—" : formatCurrency(meta.total, meta.moneda ?? "MXN")}
        />
        <Dato etiqueta="RFC emisor" valor={meta.rfcEmisor ?? "—"} />
        <Dato etiqueta="Fecha" valor={meta.fechaEmision ? formatDate(meta.fechaEmision) : "—"} />
        <p className="sm:col-span-2 truncate text-xs text-muted-foreground">UUID: {meta.uuid}</p>
      </div>
    </div>
  );
}
