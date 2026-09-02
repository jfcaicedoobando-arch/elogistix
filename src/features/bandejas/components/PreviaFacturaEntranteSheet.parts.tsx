/**
 * Piezas de la vista previa lateral del buzón CxP (v13.388.0).
 * Extraídas para mantener la complejidad del contenedor bajo control.
 */
import { Link } from "react-router-dom";
import {
  CheckCircle2, Download, ExternalLink, FileCode2, FilePlus2, Maximize2, Minimize2, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/shared/Hint";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PdfObjectViewer } from "@/components/shared/PdfObjectViewer";
import { formatDate } from "@/lib/formatters/dates";
import { antiguedadEntrante, entranteSinXml } from "@/features/bandejas/domain/facturasEntrantesBuzon";
import { etiquetaEstadoEntrante, varianteEstadoEntrante } from "@/lib/domain/facturasEntrantes";
import type { FacturaEntranteRow } from "@/features/cxp/services";

function DatoLinea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="text-overline">{etiqueta}</p>
      <Hint label={valor}><p className="truncate text-sm font-medium">{valor}</p></Hint>
    </div>
  );
}

export function PreviaBadges({ row }: { row: FacturaEntranteRow }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={varianteEstadoEntrante(row.estado)} size="sm">
        {etiquetaEstadoEntrante(row.estado)}
      </Badge>
      <Badge variant="outline" size="sm">{antiguedadEntrante(row).label}</Badge>
      {entranteSinXml(row) && <Badge variant="warning" size="sm">Falta XML</Badge>}
    </div>
  );
}

export function PreviaDatos({ row }: { row: FacturaEntranteRow }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border p-3 lg:grid-cols-4">
      <DatoLinea etiqueta="Expediente" valor={row.embarques?.expediente ?? "—"} />
      <DatoLinea etiqueta="Folio" valor={row.folio_serie ?? "—"} />
      <DatoLinea etiqueta="Archivo" valor={row.nombre_archivo} />
      <DatoLinea etiqueta="Subido el" valor={formatDate(row.created_at)} />
      {row.nota && <DatoLinea etiqueta="Nota" valor={row.nota} />}
      {row.rechazo_motivo && <DatoLinea etiqueta="Motivo de rechazo" valor={row.rechazo_motivo} />}
    </div>
  );
}

interface VisorProps {
  url: string | null;
  error: boolean;
  esPdf: boolean;
  nombreArchivo?: string;
  ampliado: boolean;
  onToggleAmpliado: () => void;
}

function VisorToolbar({ url, nombreArchivo, ampliado, onToggleAmpliado }: {
  url: string | null; nombreArchivo?: string; ampliado: boolean; onToggleAmpliado: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-2 py-1.5">
      <span className="truncate text-xs text-muted-foreground">Vista previa del PDF</span>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" onClick={onToggleAmpliado}>
          {ampliado
            ? <><Minimize2 className="mr-1.5 size-4" aria-hidden /> Reducir</>
            : <><Maximize2 className="mr-1.5 size-4" aria-hidden /> Ampliar</>}
        </Button>
        {url && (
          <>
            <Button size="sm" variant="ghost" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 size-4" aria-hidden /> Pestaña nueva
              </a>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href={url} download={nombreArchivo ?? "documento.pdf"}>
                <Download className="mr-1.5 size-4" aria-hidden /> Descargar
              </a>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function PreviaVisor({
  url, error, esPdf, nombreArchivo, ampliado, onToggleAmpliado,
}: VisorProps) {
  if (error) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No se pudo cargar la vista previa (el archivo no se descargó). Usa "Ver" o descarga el
        documento desde las acciones.
      </p>
    );
  }
  if (!esPdf) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Este documento no es un PDF: descárgalo para revisarlo.
      </p>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <VisorToolbar
        url={url}
        nombreArchivo={nombreArchivo}
        ampliado={ampliado}
        onToggleAmpliado={onToggleAmpliado}
      />
      <div className="min-h-0 flex-1">
        {url
          ? <PdfObjectViewer url={url} title="Vista previa de la factura" nombreArchivo={nombreArchivo} />
          : <Skeleton className="h-full w-full" />}
      </div>
    </div>
  );
}

interface AccionesProps {
  row: FacturaEntranteRow;
  procesable: boolean;
  onVerXml: (row: FacturaEntranteRow) => void;
  onCapturar: (row: FacturaEntranteRow) => void;
  onCrearFactura: (row: FacturaEntranteRow) => void;
  onRechazar: (row: FacturaEntranteRow) => void;
}

export function PreviaAcciones({
  row, procesable, onVerXml, onCapturar, onCrearFactura, onRechazar,
}: AccionesProps) {
  return (
    <div className="flex flex-wrap gap-2 border-t bg-background pt-3">
      {row.xml_path && (
        <Button size="sm" variant="outline" onClick={() => onVerXml(row)}>
          <FileCode2 className="mr-2 size-4" /> Descargar XML
        </Button>
      )}
      <Button size="sm" variant="secondary" asChild>
        <Link to={`/embarques/${row.embarque_id}?tab=costos&focus=facturas-entrantes`}>
          Ir al embarque
        </Link>
      </Button>
      {procesable && (
        <>
          <Button size="sm" onClick={() => onCrearFactura(row)}>
            <FilePlus2 className="mr-2 size-4" /> Capturar factura
          </Button>
          <Button size="sm" variant="outline" onClick={() => onCapturar(row)}>
            <CheckCircle2 className="mr-2 size-4" /> Vincular a factura existente
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRechazar(row)}>
            <XCircle className="mr-2 size-4 text-destructive" /> Rechazar
          </Button>
        </>
      )}
    </div>
  );
}
