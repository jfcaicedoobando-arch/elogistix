/**
 * Columnas + badge de estado para `ComprasNotasCredito` — extraídos en
 * v13.182.0 (Wave 2 splits).
 */
import { ToneBadge } from "@/features/cxp/components/ToneBadge";
import type { ChipTone } from "@/lib/ui/badgeTone";
import { defineColumns } from "@/components/shared/DataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { NotaCreditoRow } from "@/features/compras/services/notasCreditoGlobal";

const NC_TONES: Record<string, { tone: ChipTone; label: string }> = {
  Aplicada:  { tone: "success", label: "Aplicada" },
  Aprobada:  { tone: "info",    label: "Aprobada" },
  Cancelada: { tone: "neutral", label: "Cancelada" },
  Borrador:  { tone: "neutral", label: "Borrador" },
};

export function EstadoNCBadge({ estado }: { estado: NotaCreditoRow["estado"] }) {
  const meta = NC_TONES[estado] ?? { tone: "neutral" as ChipTone, label: estado };
  return <ToneBadge tone={meta.tone} size="md">{meta.label}</ToneBadge>;
}


export function buildNotasCreditoColumns() {
  return defineColumns<NotaCreditoRow>([
    {
      id: "fecha",
      header: "Fecha",
      accessorFn: (r) => r.fecha,
      cell: ({ row }) => formatDate(row.original.fecha),
    },
    {
      id: "folio_nc",
      header: "Folio NC",
      accessorFn: (r) => r.folio_nc ?? "—",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.folio_nc ?? "—"}</span>
      ),
    },
    {
      id: "proveedor",
      header: "Proveedor",
      accessorFn: (r) => r.proveedor_nombre ?? "—",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.proveedor_nombre ?? "—"}</span>
      ),
    },
    {
      id: "factura",
      header: "Factura",
      accessorFn: (r) => r.factura_folio_interno ?? "—",
      cell: ({ row }) => (
        <div className="flex flex-col text-xs">
          <span>{row.original.factura_folio_interno ?? "—"}</span>
          {row.original.factura_folio_proveedor && (
            <span className="text-muted-foreground">
              Prov: {row.original.factura_folio_proveedor}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "motivo",
      header: "Motivo",
      accessorFn: (r) => r.motivo,
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (r) => r.estado,
      cell: ({ row }) => <EstadoNCBadge estado={row.original.estado} />,
    },
    {
      id: "monto",
      header: "Monto",
      accessorFn: (r) => r.monto,
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(row.original.monto, row.original.moneda)}
        </span>
      ),
      meta: { align: "right" },
    },
  ]);
}
