/**
 * Tarjeta móvil del tab Proformas (/facturacion → Proformas).
 * Migra la tabla de escritorio a `ResponsiveDataTable` conservando folio,
 * cliente, fecha y estado unificado para decidir sin scroll horizontal.
 */
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { getEstadoUnificado, etiquetaEstadoUnificado } from "@/lib/domain/estadoUnificado";
import { etiquetaProformaConvertida } from "@/lib/domain/etiquetaCicloProforma";
import type { ProformaConFactura } from "@/features/embarques/hooks";
import { totalesListadoProforma } from "@/features/proformas/domain";
import { labelExpediente } from "@/lib/domain/labelExpediente";

export function ProformaMobileCard({ proforma }: { proforma: ProformaConFactura }) {
  const estado = getEstadoUnificado(proforma);
  const totales = totalesListadoProforma(proforma);
  // R170-01: mismo criterio que la tabla de escritorio — dentro del bucket
  // "facturada" distingue borrador/por-timbrar/emitida.
  const label =
    estado === "facturada"
      ? etiquetaProformaConvertida(proforma.facturas_asociadas ?? [])
      : etiquetaEstadoUnificado(proforma);
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-body truncate">{proforma.numero}</span>
        <StatusBadge domain="proforma" status={estado} label={label} />
      </div>
      <div className="text-body-sm text-muted-foreground truncate">
        {toTitleCase(proforma.cliente_nombre ?? "") || "—"}
      </div>
      <div className="text-label text-muted-foreground">
        {labelExpediente(proforma.expediente, proforma.embarque_id)} · {proforma.fecha_emision ? formatDate(proforma.fecha_emision) : "-"}
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-body-sm tabular-nums">
        <span>{formatCurrency(totales.total_mxn, "MXN")}</span>
        <span>{formatCurrency(totales.total_usd, "USD")}</span>
      </div>
      {proforma.totales_origen === "encabezado_sin_detalle" && (
        <div className="text-label text-muted-foreground">Importe guardado · Detalle de conceptos no disponible</div>
      )}
    </div>
  );
}
