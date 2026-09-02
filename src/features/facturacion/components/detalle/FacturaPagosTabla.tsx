/**
 * FacturaPagosTabla — tabla presentacional del historial de pagos.
 * Extraída de `FacturaPagosSection` para respetar el límite de 200 líneas.
 * Migrada a `DataTable` (Ola F, punto 8) con `TABLE_DENSITY.embebida`.
 * Migrada a `ResponsiveDataTable` para eliminar scroll horizontal en móvil.
 */
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { FORMAS_PAGO_SAT, labelDeCatalogo } from "@/constants/catalogosSAT";
import { PagoRepCell } from "./PagoRepCell";
import { FacturaPagosMobileCard } from "./FacturaPagosMobileCard";

interface PagoRow {
  id: string;
  fecha_pago: string;
  monto: number | string;
  monto_aplicado_factura: number | string;
  moneda: string;
  forma_pago: string;
  referencia?: string | null;
  estado_rep?: string | null;
  serie_rep?: string | null;
  folio_rep?: number | string | null;
  uuid_rep?: string | null;
  rep_cancelado_en?: string | null;
}

interface Props {
  pagos: PagoRow[];
  facturaId: string;
  moneda: string;
  canEdit: boolean;
  onEliminar: (pagoId: string) => void;
  onPreviewRep: (id: string, label: string) => void;
}

export function FacturaPagosTabla({
  pagos, facturaId, moneda, canEdit, onEliminar, onPreviewRep,
}: Props) {
  const columns: ColumnDef<PagoRow, unknown>[] = defineColumns<PagoRow>([
    { id: "fecha", header: "Fecha", meta: { width: COL_W.fecha }, cell: ({ row }) => formatDate(row.original.fecha_pago) },
    {
      id: "monto", header: "Monto", meta: { width: COL_W.monto, align: "right" },
      cell: ({ row }) => formatCurrency(Number(row.original.monto), row.original.moneda),
    },
    {
      id: "aplicado", header: "Aplicado", meta: { width: COL_W.monto, align: "right" },
      cell: ({ row }) => formatCurrency(Number(row.original.monto_aplicado_factura), moneda),
    },
    {
      id: "forma", header: "Forma", meta: { width: COL_W.short },
      cell: ({ row }) => labelDeCatalogo(FORMAS_PAGO_SAT, row.original.forma_pago),
    },
    {
      id: "referencia", header: "Referencia", meta: { width: COL_W.texto },
      cell: ({ row }) => (
        <Hint label={row.original.referencia ?? ""}>
          <span className="block max-w-[200px] truncate">
            {row.original.referencia || "—"}
          </span>
        </Hint>
      ),
    },
    {
      id: "rep", header: "REP", meta: { width: COL_W.estado },
      cell: ({ row }) => {
        const p = row.original;
        return (
          <PagoRepCell
            pagoId={p.id}
            facturaId={facturaId}
            estadoRep={p.estado_rep ?? null}
            serieRep={p.serie_rep ?? null}
            folioRep={p.folio_rep ?? null}
            onPreview={onPreviewRep}
          />
        );
      },
    },
    ...(canEdit
      ? [{
          id: "acciones", header: "", meta: { width: COL_W.acciones },
          cell: ({ row }: { row: { original: PagoRow } }) => {
            const p = row.original;
            const repVivo = !!p.uuid_rep && !p.rep_cancelado_en;
            return (
              <Hint
                label={
                  repVivo
                    ? "Cancela el REP (complemento de pago) antes de eliminar este pago"
                    : "Eliminar pago"
                }
              >
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={repVivo}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (repVivo) return;
                    onEliminar(p.id);
                  }}
                  aria-label="Eliminar pago"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </Hint>
            );
          },
        }]
      : []),
  ]);

  return (
    <ResponsiveDataTable
      columns={columns}
      data={pagos}
      rowKey={(p) => p.id}
      density={TABLE_DENSITY.embebida}
      emptyMessage="Sin pagos registrados."
      mobileCard={(row) => (
        <FacturaPagosMobileCard
          row={row}
          facturaId={facturaId}
          canEdit={canEdit}
          onEliminar={onEliminar}
          onPreviewRep={onPreviewRep}
        />
      )}
    />
  );
}
