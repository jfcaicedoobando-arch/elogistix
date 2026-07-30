/**
 * Renglón del buzón de facturas de proveedor dentro del embarque.
 * Muestra qué archivos llegaron (PDF/XML), los datos leídos del CFDI y las
 * acciones disponibles según el estado y el rol.
 */
import { useRef } from "react";
import { FileCode2, FileText, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters/dates";
import { formatCurrency } from "@/lib/formatters/numbers";
import {
  chipsArchivosEntrante,
  diasEnEspera,
  etiquetaEstadoEntrante,
  faltaXmlFiscal,
  varianteEstadoEntrante,
} from "@/lib/domain/facturasEntrantes";
import type { FacturaEntranteRow } from "@/features/cxp/services/facturasEntrantes";

interface Props {
  row: FacturaEntranteRow;
  puedeEliminar: boolean;
  puedeAdjuntarXml: boolean;
  onVer: (path: string, nombre: string) => void;
  onAdjuntarXml: (row: FacturaEntranteRow, xml: File) => void;
  onEliminar: (row: FacturaEntranteRow) => void;
}

export function FacturaEntranteItem({
  row, puedeEliminar, puedeAdjuntarXml, onVer, onAdjuntarXml, onEliminar,
}: Props) {
  const inputXml = useRef<HTMLInputElement>(null);
  const chips = chipsArchivosEntrante(row);
  const tieneXml = chips.includes("xml");
  const tienePdf = chips.includes("pdf");
  const esNacional = (row.proveedores?.origen ?? "Nacional") === "Nacional";
  const faltaXml = faltaXmlFiscal({ esNacional, tieneXml });

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{row.nombre_archivo}</span>
          <Badge variant={varianteEstadoEntrante(row.estado)} size="sm">
            {etiquetaEstadoEntrante(row.estado)}
          </Badge>
          {tienePdf && <Badge variant="outline" size="sm">PDF</Badge>}
          {tieneXml && <Badge variant="outline" size="sm">XML</Badge>}
          {faltaXml && <Badge variant="warning" size="sm">Falta XML</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          Subida el {formatDate(row.created_at)}
          {row.estado === "por_capturar" && ` · ${diasEnEspera(row.created_at)} día(s) en espera`}
          {row.proveedores?.nombre ? ` · ${row.proveedores.nombre}` : ""}
        </p>
        {(row.folio_serie || row.total_detectado != null) && (
          <p className="text-xs text-muted-foreground">
            {row.folio_serie ? `Folio ${row.folio_serie}` : "Sin folio"}
            {row.total_detectado != null
              ? ` · ${formatCurrency(Number(row.total_detectado), row.moneda_detectada ?? "MXN")}`
              : ""}
          </p>
        )}
        {row.nota && <p className="text-xs text-muted-foreground">Nota: {row.nota}</p>}
        {row.rechazo_motivo && <p className="text-xs text-destructive">Rechazada: {row.rechazo_motivo}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {tienePdf && (
          <Button size="sm" variant="outline" onClick={() => onVer(row.archivo_path, row.nombre_archivo)}>
            <FileText className="mr-2 h-4 w-4" /> Ver PDF
          </Button>
        )}
        {tieneXml && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onVer(row.xml_path ?? row.archivo_path, row.xml_nombre ?? row.nombre_archivo)}
          >
            <FileCode2 className="mr-2 h-4 w-4" /> XML
          </Button>
        )}
        {!tieneXml && puedeAdjuntarXml && (
          <>
            <Button size="sm" variant="secondary" onClick={() => inputXml.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Adjuntar XML
            </Button>
            <input
              ref={inputXml}
              type="file"
              className="hidden"
              accept=".xml,text/xml,application/xml"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) onAdjuntarXml(row, archivo);
                e.target.value = "";
              }}
            />
          </>
        )}
        {puedeEliminar && (
          <Button size="sm" variant="ghost" onClick={() => onEliminar(row)} aria-label="Retirar del buzón">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}
