/**
 * Partes de la fila del buzón CxP (v13.398.0). Se extraen para mantener la
 * complejidad de `FacturaEntranteRow` bajo el límite del proyecto.
 */
import { StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters/dates";
import { entranteSinImporte } from "@/lib/domain/facturasEntrantesBuzon";
import type { FacturaEntranteRow as Fila } from "@/features/cxp/services/facturasEntrantes";

/** Proveedor + avisos de la fila (falta XML, CFDI ya capturado, nota). */
export function ProveedorEntrante({
  row,
  sinXml,
  yaCapturado,
  folioExistente,
}: {
  row: Fila;
  sinXml: boolean;
  yaCapturado: boolean;
  folioExistente: string | null;
}) {
  const nombre = row.proveedores?.nombre ?? null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {nombre ? (
        <span className="truncate text-sm font-semibold">{nombre}</span>
      ) : (
        <span className="truncate text-sm italic text-muted-foreground">
          Proveedor sin identificar
          {row.rfc_emisor ? ` · RFC ${row.rfc_emisor}` : ""}
        </span>
      )}
      {sinXml && <Badge variant="warning" size="sm">Falta XML</Badge>}
      {yaCapturado && (
        <Badge variant="neutral" size="sm">
          CFDI ya capturado{folioExistente ? ` · ${folioExistente}` : ""}
        </Badge>
      )}
      {row.nota && (
        <Tooltip>
          <TooltipTrigger asChild>
            <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{row.nota}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/** Expediente · folio · fecha de emisión · nombre de archivo (relegado). */
export function MetaEntrante({ row }: { row: Fila }) {
  const fecha = row.fecha_emision
    ? `Emitida ${formatDate(row.fecha_emision)}`
    : `Recibida ${formatDate(row.created_at)}`;

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <span className="shrink-0">{row.embarques?.expediente ?? "Sin expediente"}</span>
      {row.folio_serie && <span className="shrink-0">· Folio {row.folio_serie}</span>}
      <span className="shrink-0">· {fecha}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="hidden truncate text-muted-foreground/70 sm:inline">· {row.nombre_archivo}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm break-all">{row.nombre_archivo}</TooltipContent>
      </Tooltip>
    </p>
  );
}

/** Importe detectado del CFDI, alineado a la derecha. */
export function ImporteEntrante({ row }: { row: Fila }) {
  if (entranteSinImporte(row)) {
    return (
      <div className="w-full shrink-0 text-left sm:w-[128px] sm:text-right">
        <span className="text-xs text-muted-foreground">Sin importe</span>
      </div>
    );
  }

  const moneda = row.moneda_detectada ?? "MXN";
  return (
    <div className="w-full shrink-0 text-left sm:w-[128px] sm:text-right">
      <p className="truncate text-sm font-semibold tabular-nums">
        {formatCurrency(Number(row.total_detectado), moneda)}
      </p>
    </div>
  );
}

