/**
 * Fila del Buzón de facturas de proveedor (CxP Inbox).
 *
 * v13.365.0 — Fila compacta de una sola línea a 1366 px: barra de antigüedad,
 * proveedor como dato principal y acciones secundarias en el menú de tres puntos.
 * v13.398.0 — Rejilla de columnas fijas (antigüedad · datos · importe · acciones),
 * importe detectado visible, fecha de emisión y nombre de archivo relegado.
 */
import { StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FacturaEntranteAcciones } from "@/features/bandejas/components/FacturaEntranteAcciones";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters/dates";
import { cn } from "@/lib/utils";
import { chipsArchivosEntrante } from "@/lib/domain/facturasEntrantes";
import {
  antiguedadEntrante,
  entranteSinImporte,
  entranteSinXml,
  type TonoAntiguedad,
} from "@/lib/domain/facturasEntrantesBuzon";
import type { FacturaEntranteRow } from "@/features/cxp/services/facturasEntrantes";

const BARRA_TONO: Record<TonoAntiguedad, string> = {
  neutral: "bg-muted",
  info: "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

const BADGE_TONO: Record<TonoAntiguedad, "neutral" | "info" | "warning" | "destructive"> = {
  neutral: "neutral",
  info: "info",
  warning: "warning",
  destructive: "destructive",
};

interface Props {
  row: FacturaEntranteRow;
  puedeProcesar: boolean;
  /** Sólo lectura: pestañas de historial (capturadas / rechazadas). */
  soloLectura?: boolean;
  /** v13.368.0 — Factura viva que ya usa este CFDI; bloquea volver a capturarlo. */
  facturaExistenteId?: string | null;
  facturaExistenteFolio?: string | null;
  onVer: (row: FacturaEntranteRow) => void;
  onVerXml: (row: FacturaEntranteRow) => void;
  onCapturar: (row: FacturaEntranteRow) => void;
  /** v13.366.0 — Captura la factura de proveedor con los datos del documento. */
  onCrearFactura: (row: FacturaEntranteRow) => void;
  onRechazar: (row: FacturaEntranteRow) => void;
}

export function FacturaEntranteRow({
  row,
  puedeProcesar,
  soloLectura = false,
  facturaExistenteId = null,
  facturaExistenteFolio = null,
  onVer,
  onVerXml,
  onCapturar,
  onCrearFactura,
  onRechazar,
}: Props) {
  const antiguedad = antiguedadEntrante(row);
  const sinXml = entranteSinXml(row);
  const sinImporte = entranteSinImporte(row);
  const chips = chipsArchivosEntrante(row);
  const nombreProveedor = row.proveedores?.nombre ?? null;
  const yaCapturado = !soloLectura && facturaExistenteId !== null;
  const fecha = row.fecha_emision
    ? `Emitida ${formatDate(row.fecha_emision)}`
    : `Recibida ${formatDate(row.created_at)}`;

  return (
    <Card className="relative overflow-hidden">
      <div className={cn("absolute inset-y-0 left-0 w-1", BARRA_TONO[antiguedad.tono])} />
      <div className="flex items-center gap-3 py-2.5 pl-4 pr-3">
        <div className="flex w-[92px] shrink-0 flex-col items-start gap-1">
          <Badge variant={BADGE_TONO[antiguedad.tono]} size="sm">{antiguedad.label}</Badge>
          <div className="flex gap-1">
            {chips.map((chip) => (
              <Badge key={chip} variant="outline" size="xs">{chip.toUpperCase()}</Badge>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onVer(row)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            {nombreProveedor ? (
              <span className="truncate text-sm font-semibold">{nombreProveedor}</span>
            ) : (
              <span className="truncate text-sm italic text-muted-foreground">
                Proveedor sin identificar
                {row.rfc_emisor ? ` · RFC ${row.rfc_emisor}` : ""}
              </span>
            )}
            {sinXml && <Badge variant="warning" size="sm">Falta XML</Badge>}
            {yaCapturado && (
              <Badge variant="neutral" size="sm">
                CFDI ya capturado{facturaExistenteFolio ? ` · ${facturaExistenteFolio}` : ""}
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
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0">{row.embarques?.expediente ?? "Sin expediente"}</span>
            {row.folio_serie && <span className="shrink-0">· Folio {row.folio_serie}</span>}
            <span className="shrink-0">· {fecha}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate text-muted-foreground/70">· {row.nombre_archivo}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm break-all">{row.nombre_archivo}</TooltipContent>
            </Tooltip>
          </p>
        </button>

        <div className="w-[128px] shrink-0 text-right">
          {sinImporte ? (
            <span className="text-xs text-muted-foreground">Sin importe</span>
          ) : (
            <>
              <p className="truncate text-sm font-semibold tabular-nums">
                {formatCurrency(Number(row.total_detectado), row.moneda_detectada ?? "MXN")}
              </p>
              <p className="text-xs text-muted-foreground">{row.moneda_detectada ?? "MXN"}</p>
            </>
          )}
        </div>

        <FacturaEntranteAcciones
          row={row}
          editable={!soloLectura && puedeProcesar}
          facturaExistenteId={facturaExistenteId}
          onVer={onVer}
          onVerXml={onVerXml}
          onCapturar={onCapturar}
          onCrearFactura={onCrearFactura}
          onRechazar={onRechazar}
        />
      </div>
    </Card>
  );
}
