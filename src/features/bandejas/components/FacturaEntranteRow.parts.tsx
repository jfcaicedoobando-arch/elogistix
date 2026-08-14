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
  canceladaExistente = false,
}: {
  row: Fila;
  sinXml: boolean;
  yaCapturado: boolean;
  folioExistente: string | null;
  /** v13.501.0 — La factura previa del mismo CFDI está cancelada. */
  canceladaExistente?: boolean;
}) {
  const nombre = row.proveedores?.nombre ?? null;
  const folio = folioExistente ? ` · ${folioExistente}` : "";

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
      {yaCapturado && canceladaExistente && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="warning" size="sm">CFDI de factura cancelada{folio}</Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Este CFDI se capturó antes en {folioExistente ?? "una factura"}, que después se
            canceló. No se puede volver a capturar con el mismo UUID: retira el documento del
            buzón o consulta la factura cancelada.
          </TooltipContent>
        </Tooltip>
      )}
      {yaCapturado && !canceladaExistente && (
        <Badge variant="neutral" size="sm">
          CFDI ya capturado{folio}
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
          <span className="hidden truncate text-muted-foreground/70 md:inline">· {row.nombre_archivo}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm break-all">{row.nombre_archivo}</TooltipContent>
      </Tooltip>
    </p>
  );
}

/** Importe detectado del CFDI, alineado a la derecha. */
export function ImporteEntrante({
  row,
  onAgregarImporte,
}: {
  row: Fila;
  /** v13.618.0 — Abre la corrección para capturar el importe faltante. */
  onAgregarImporte?: (row: Fila) => void;
}) {
  const importe = importeEntrante(row);

  if (!importe) {
    return (
      <div className="flex w-full shrink-0 flex-col items-start gap-1 md:w-[128px] md:items-end">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="warning" size="sm">Sin importe</Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            El documento llegó sin XML y quien lo subió no capturó el importe. Agrégalo para
            poder priorizar y cotejar la captura.
          </TooltipContent>
        </Tooltip>
        {onAgregarImporte && (
          <Button
            size="sm"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => onAgregarImporte(row)}
          >
            Agregar importe
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full shrink-0 text-left md:w-[128px] md:text-right">
      <p className="truncate text-sm font-semibold tabular-nums">
        {formatCurrency(importe.monto, importe.moneda)}
      </p>
      {importe.fuente === "declarado" && (
        <p className="text-[11px] text-muted-foreground">Declarado por operaciones</p>
      )}
    </div>
  );
}

