/**
 * Tarjeta móvil del tab Proformas (/facturacion → Proformas).
 * Migra la tabla de escritorio a `ResponsiveDataTable` conservando folio,
 * cliente, fecha y estado unificado para decidir sin scroll horizontal.
 */
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, toTitleCase } from "@/lib/formatters";
import { getEstadoUnificado, LABEL_ESTADO_UNIFICADO } from "@/lib/domain/estadoUnificado";
import { etiquetaProformaConvertida } from "@/lib/domain/etiquetaCicloProforma";
import type { ProformaConFactura } from "@/features/embarques/hooks";

export function ProformaMobileCard({ proforma }: { proforma: ProformaConFactura }) {
  const estado = getEstadoUnificado(proforma);
  // R170-01: mismo criterio que la tabla de escritorio — dentro del bucket
  // "facturada" distingue borrador/por-timbrar/emitida.
  const label =
    estado === "facturada"
      ? etiquetaProformaConvertida(proforma.facturas_asociadas ?? [])
      : LABEL_ESTADO_UNIFICADO[estado];
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
        {proforma.fecha_emision ? formatDate(proforma.fecha_emision) : "—"}
      </div>
    </div>
  );
}
