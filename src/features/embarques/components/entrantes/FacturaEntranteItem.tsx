/**
 * Renglón del buzón de facturas de proveedor dentro del embarque.
 * Muestra qué archivos llegaron (PDF/XML), los datos leídos del CFDI y las
 * acciones disponibles según el estado y el rol.
 */
import { useRef } from "react";
import { Link } from "react-router-dom";
import { FileCode2, FileText, Link2 as LinkIcon, Trash2, Upload } from "lucide-react";
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

function FolioInternoChip({ row }: { row: FacturaEntranteRow }) {
  const folio = row.proveedor_facturas?.folio_interno;
  if (!row.proveedor_factura_id) return null;
  return (
    <Link
      to={`/compras/facturas/${row.proveedor_factura_id}`}
      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-xs tabular-nums text-primary hover:bg-primary/10"
      title="Ver la factura de proveedor en Libre Carga"
    >
      <LinkIcon className="h-3 w-3" />
      {folio ?? "Ver factura"}
    </Link>
  );
}

function MetaEntrante({ row }: { row: FacturaEntranteRow }) {
  const total = row.total_detectado;
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Subida el {formatDate(row.created_at)}
        {row.estado === "por_capturar" ? ` · ${diasEnEspera(row.created_at)} día(s) en espera` : ""}
        {row.proveedores?.nombre ? ` · ${row.proveedores.nombre}` : ""}
      </p>
      {(row.folio_serie || total != null) && (
        <p className="text-xs text-muted-foreground">
          {row.folio_serie ? `Folio proveedor ${row.folio_serie}` : "Sin folio del proveedor"}
          {total != null ? ` · ${formatCurrency(Number(total), row.moneda_detectada ?? "MXN")}` : ""}
        </p>
      )}
      {row.nota && <p className="text-xs text-muted-foreground">Nota: {row.nota}</p>}
      {row.rechazo_motivo && <p className="text-xs text-destructive">Rechazada: {row.rechazo_motivo}</p>}
    </>
  );
}

function AdjuntarXmlButton({ onSelect }: { onSelect: (xml: File) => void }) {
  const inputXml = useRef<HTMLInputElement>(null);
  return (
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
          if (archivo) onSelect(archivo);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function FacturaEntranteItem({
  row, puedeEliminar, puedeAdjuntarXml, onVer, onAdjuntarXml, onEliminar,
}: Props) {
  const chips = chipsArchivosEntrante(row);
  const tieneXml = chips.includes("xml");
  const tienePdf = chips.includes("pdf");
  const faltaXml = faltaXmlFiscal({
    esNacional: (row.proveedores?.origen_proveedor ?? "Nacional") === "Nacional",
    tieneXml,
  });

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
        <MetaEntrante row={row} />
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
          <AdjuntarXmlButton onSelect={(xml) => onAdjuntarXml(row, xml)} />
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
