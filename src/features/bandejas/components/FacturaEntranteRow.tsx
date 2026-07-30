/**
 * Fila del Buzón de facturas de proveedor (CxP Inbox).
 *
 * v13.365.0 — Fila compacta de una sola línea a 1366 px: barra de antigüedad,
 * proveedor como dato principal y acciones secundarias en el menú de tres puntos.
 */
import { Link } from "react-router-dom";
import { CheckCircle2, Eye, FileCode2, MoreHorizontal, StickyNote, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/formatters/dates";
import { cn } from "@/lib/utils";
import { chipsArchivosEntrante } from "@/lib/domain/facturasEntrantes";
import {
  antiguedadEntrante,
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
  onVer: (row: FacturaEntranteRow) => void;
  onVerXml: (row: FacturaEntranteRow) => void;
  onCapturar: (row: FacturaEntranteRow) => void;
  onRechazar: (row: FacturaEntranteRow) => void;
}

export function FacturaEntranteRow({
  row,
  puedeProcesar,
  soloLectura = false,
  onVer,
  onVerXml,
  onCapturar,
  onRechazar,
}: Props) {
  const antiguedad = antiguedadEntrante(row);
  const sinXml = entranteSinXml(row);
  const chips = chipsArchivosEntrante(row);
  const proveedor = row.proveedores?.nombre ?? "Proveedor sin identificar";

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
            <span className="truncate text-sm font-semibold">{proveedor}</span>
            {sinXml && <Badge variant="warning" size="sm">Falta XML</Badge>}
            {row.nota && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{row.nota}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {row.embarques?.expediente ?? "Sin expediente"}
            {row.folio_serie ? ` · Folio ${row.folio_serie}` : ""}
            {` · ${formatDate(row.created_at)}`}
            {` · ${row.nombre_archivo}`}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => onVer(row)}>
            <Eye className="mr-2 h-4 w-4" /> Ver
          </Button>
          {!soloLectura && puedeProcesar && (
            <Button size="sm" onClick={() => onCapturar(row)}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Capturada
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Más acciones">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {row.xml_path && (
                <DropdownMenuItem onClick={() => onVerXml(row)}>
                  <FileCode2 className="mr-2 h-4 w-4" /> Descargar XML
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to={`/embarques/${row.embarque_id}?tab=costos&focus=facturas-entrantes`}>
                  Ir al embarque
                </Link>
              </DropdownMenuItem>
              {!soloLectura && puedeProcesar && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onRechazar(row)}
                >
                  <XCircle className="mr-2 h-4 w-4" /> Rechazar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
