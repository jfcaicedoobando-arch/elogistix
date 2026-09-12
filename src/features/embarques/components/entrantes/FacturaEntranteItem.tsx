/**
 * Renglón del buzón de facturas de proveedor dentro del embarque.
 * Acomodo denso en columnas (archivo/estado · proveedor · montos · acciones);
 * el motivo de rechazo se muestra como franja a todo el ancho.
 */
import { Link } from "react-router-dom";
import { FileText, Link2 as LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  chipsArchivosEntrante,
  etiquetaEstadoEntrante,
  faltaXmlFiscal,
  varianteEstadoEntrante,
} from "@/lib/domain/facturasEntrantes";
import {
  MetaEntranteMontos,
  MetaEntranteNotas,
  MetaEntranteProveedor,
  MetaEntranteRechazo,
} from "@/features/embarques/components/entrantes/MetaEntrante";
import { AccionesEntrante } from "@/features/embarques/components/entrantes/AccionesEntrante";
import type { FacturaEntranteRow } from "@/features/cxp/services";

interface Props {
  row: FacturaEntranteRow;
  puedeEliminar: boolean;
  puedeAdjuntarXml: boolean;
  /** v13.494.0 — Documento rechazado que puede volver a "Por capturar". */
  puedeReactivar?: boolean;
  /** v13.508.0 — Corregir proveedor/monto/conceptos sin volver a subir. */
  puedeCorregir?: boolean;
  onVer: (path: string, nombre: string) => void;
  onAdjuntarXml: (row: FacturaEntranteRow, xml: File) => void;
  onEliminar: (row: FacturaEntranteRow) => void;
  onReactivar?: (row: FacturaEntranteRow) => void;
  onCorregir?: (row: FacturaEntranteRow) => void;
}

function FolioInternoChip({ row }: { row: FacturaEntranteRow }) {
  const folio = row.proveedor_facturas?.folio_interno;
  if (!row.proveedor_factura_id) return null;
  return (
    <Link
      to={`/compras/facturas/${row.proveedor_factura_id}`}
      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-body-sm tabular-nums text-primary hover:bg-primary/10"
      title="Ver la factura de proveedor en Libre Carga"
    >
      <LinkIcon className="h-3 w-3" />
      {folio ?? "Ver factura"}
    </Link>
  );
}

function IconoDocumento({ rechazada }: { rechazada: boolean }) {
  const tono = rechazada
    ? "bg-destructive/10 text-destructive"
    : "bg-muted text-muted-foreground";
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${tono}`}>
      <FileText className="h-4 w-4" />
    </div>
  );
}

export function FacturaEntranteItem({
  row, puedeEliminar, puedeAdjuntarXml, puedeReactivar = false, puedeCorregir = false,
  onVer, onAdjuntarXml, onEliminar, onReactivar, onCorregir,
}: Props) {
  const chips = chipsArchivosEntrante(row);
  const tieneXml = chips.includes("xml");
  const tienePdf = chips.includes("pdf");
  const rechazada = row.estado === "rechazada";
  const faltaXml = faltaXmlFiscal({
    esNacional: (row.proveedores?.origen_proveedor ?? "Nacional") === "Nacional",
    tieneXml,
  });

  return (
    <div className="relative overflow-hidden rounded-md border transition-colors hover:bg-muted/40">
      {rechazada && <div className="absolute inset-y-0 left-0 w-1 bg-destructive" aria-hidden="true" />}
      <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-12 md:items-start md:gap-4">
        <div className="flex min-w-0 flex-col gap-1.5 md:col-span-4">
          <div className="flex items-center gap-2">
            <IconoDocumento rechazada={rechazada} />
            <span className="truncate text-body-sm font-semibold text-foreground" title={row.nombre_archivo}>
              {row.nombre_archivo}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={varianteEstadoEntrante(row.estado)} size="sm">
              {etiquetaEstadoEntrante(row.estado)}
            </Badge>
            {tienePdf && <Badge variant="outline" size="sm">PDF</Badge>}
            {tieneXml && <Badge variant="outline" size="sm">XML</Badge>}
            {faltaXml && <Badge variant="warning" size="sm">Falta XML</Badge>}
            <FolioInternoChip row={row} />
          </div>
        </div>

        <div className="md:col-span-3">
          <MetaEntranteProveedor row={row} />
        </div>

        <div className="md:col-span-2">
          <MetaEntranteMontos row={row} />
          <MetaEntranteNotas row={row} />
        </div>

        <div className="md:col-span-3 md:flex md:justify-end">
          <AccionesEntrante
            row={row}
            tienePdf={tienePdf}
            tieneXml={tieneXml}
            puedeEliminar={puedeEliminar}
            puedeAdjuntarXml={puedeAdjuntarXml}
            puedeReactivar={puedeReactivar}
            puedeCorregir={puedeCorregir}
            onVer={onVer}
            onAdjuntarXml={onAdjuntarXml}
            onEliminar={onEliminar}
            onReactivar={onReactivar}
            onCorregir={onCorregir}
          />
        </div>
      </div>

      {row.rechazo_motivo && (
        <div className="border-t border-destructive/20 bg-destructive/5 px-3 py-2 pl-4">
          <MetaEntranteRechazo row={row} />
        </div>
      )}
    </div>
  );
}
