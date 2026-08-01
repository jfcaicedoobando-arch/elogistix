/**
 * Piezas de la vista previa lateral del buzón CxP (v13.365.0).
 * Extraídas para mantener la complejidad del contenedor bajo control.
 */
import { Link } from "react-router-dom";
import { CheckCircle2, FileCode2, FilePlus2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PdfObjectViewer } from "@/components/shared/PdfObjectViewer";
import { formatDate } from "@/lib/formatters/dates";
import { antiguedadEntrante, entranteSinXml } from "@/lib/domain/facturasEntrantesBuzon";
import { etiquetaEstadoEntrante, varianteEstadoEntrante } from "@/lib/domain/facturasEntrantes";
import type { FacturaEntranteRow } from "@/features/cxp/services/facturasEntrantes";

function DatoLinea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="max-w-[60%] truncate text-right font-medium">{valor}</span>
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
    <div className="space-y-1.5 rounded-md border p-3">
      <DatoLinea etiqueta="Expediente" valor={row.embarques?.expediente ?? "—"} />
      <DatoLinea etiqueta="Folio" valor={row.folio_serie ?? "—"} />
      <DatoLinea etiqueta="Archivo" valor={row.nombre_archivo} />
      <DatoLinea etiqueta="Subido el" valor={formatDate(row.created_at)} />
      {row.nota && <DatoLinea etiqueta="Nota" valor={row.nota} />}
      {row.rechazo_motivo && <DatoLinea etiqueta="Motivo de rechazo" valor={row.rechazo_motivo} />}
    </div>
  );
}

export function PreviaVisor({
  url,
  error,
  esPdf,
  nombreArchivo,
}: { url: string | null; error: boolean; esPdf: boolean; nombreArchivo?: string }) {
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
  if (!url) return <Skeleton className="h-full w-full" />;
  return (
    <PdfObjectViewer
      url={url}
      title="Vista previa de la factura"
      nombreArchivo={nombreArchivo}
    />
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
    <div className="flex flex-wrap gap-2">
      {row.xml_path && (
        <Button size="sm" variant="outline" onClick={() => onVerXml(row)}>
          <FileCode2 className="mr-2 h-4 w-4" /> Descargar XML
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
            <FilePlus2 className="mr-2 h-4 w-4" /> Capturar factura
          </Button>
          <Button size="sm" variant="outline" onClick={() => onCapturar(row)}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Vincular a factura existente
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRechazar(row)}>
            <XCircle className="mr-2 h-4 w-4 text-destructive" /> Rechazar
          </Button>
        </>
      )}
    </div>
  );
}
