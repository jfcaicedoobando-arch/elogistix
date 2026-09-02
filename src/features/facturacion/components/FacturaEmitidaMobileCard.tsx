/**
 * Tarjeta móvil de la bandeja /facturacion (tab "Facturas emitidas").
 * Migra la tabla de escritorio a `ResponsiveDataTable` sin perder el
 * folio, cliente, vencimiento y estado para decidir sin scroll horizontal.
 */
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { deriveFacturaBadgeEstado } from "@/features/facturacion/domain/facturaBadgeEstado";
import type { Factura } from "@/features/facturacion/routes/facturacionColumns";

export function FacturaEmitidaMobileCard({ factura }: { factura: Factura }) {
  const estado = deriveFacturaBadgeEstado(
    factura.estado,
    (factura as { acuse_cancelacion_status?: string | null }).acuse_cancelacion_status ?? null,
    (factura as { cancellation_status?: string | null }).cancellation_status ?? null,
  );
  const esBorradorSinFolio = (factura.numero ?? "").startsWith("BORRADOR-");

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-semibold text-body truncate">
          {esBorradorSinFolio ? "Sin folio (borrador)" : factura.numero}
        </div>
        <div className="text-body-sm text-muted-foreground truncate">
          {toTitleCase(factura.cliente_nombre ?? "") || "—"}
        </div>
        <div className="flex items-center gap-1.5 text-label text-muted-foreground">
          <span>{factura.fecha_vencimiento ? formatDate(factura.fecha_vencimiento) : "—"}</span>
          <StatusBadge domain="factura" status={estado} />
        </div>
      </div>
      <MoneyCell
        label="Monto"
        value={formatCurrency(factura.total, factura.moneda)}
        highlight
        className="shrink-0 max-w-[48%]"
      />
    </div>
  );
}
