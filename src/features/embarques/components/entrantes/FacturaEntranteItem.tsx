/**
 * Renglón del buzón de facturas de proveedor dentro del embarque.
 * Muestra qué archivos llegaron (PDF/XML), los datos leídos del CFDI y las
 * acciones disponibles según el estado y el rol.
 */
import { Link } from "react-router-dom";
import { Link2 as LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  chipsArchivosEntrante,
  etiquetaEstadoEntrante,
  faltaXmlFiscal,
  varianteEstadoEntrante,
} from "@/lib/domain/facturasEntrantes";
import { MetaEntrante } from "@/features/embarques/components/entrantes/MetaEntrante";
import { AccionesEntrante } from "@/features/embarques/components/entrantes/AccionesEntrante";
import type { FacturaEntranteRow } from "@/features/cxp/services/facturasEntrantes";

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
      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-xs tabular-nums text-primary hover:bg-primary/10"
      title="Ver la factura de proveedor en Libre Carga"
    >
      <LinkIcon className="h-3 w-3" />
      {folio ?? "Ver factura"}
    </Link>
  );
}

export function FacturaEntranteItem({
  row, puedeEliminar, puedeAdjuntarXml, puedeReactivar = false, puedeCorregir = false,
  onVer, onAdjuntarXml, onEliminar, onReactivar, onCorregir,
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
          <FolioInternoChip row={row} />
        </div>
        <MetaEntrante row={row} />
      </div>
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
  );
}
