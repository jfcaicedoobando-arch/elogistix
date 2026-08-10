/**
 * Columnas de la bandeja "REP pendientes", incluida la acción de timbrado
 * individual por renglón (el botón vive en la celda, no navega la fila).
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ReceiptText } from "lucide-react";
import { defineColumns } from "@/components/shared/DataTable";
import { clientColumn, moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import type { FilaRepPendiente } from "@/features/facturacion/hooks/useBandejas";

function badgeTone(estado: string): "outline" | "destructive" {
  return estado === "Error" ? "destructive" : "outline";
}

interface Opts {
  onTimbrar: (pagoId: string) => void;
  pagoEnProceso: string | null;
  bloqueado: boolean;
}

export function buildRepPendientesColumns(o: Opts) {
  return defineColumns<FilaRepPendiente>([
    {
      id: "factura",
      header: "Factura",
      accessorFn: (r) => r.factura_numero,
      enableSorting: true,
      meta: { width: COL_W.monto, className: "font-mono whitespace-nowrap", sticky: true },
      cell: ({ row }) => row.original.factura_numero,
    },
    clientColumn<FilaRepPendiente>({ accessor: (r) => r.cliente_nombre }),
    {
      ...dateColumn<FilaRepPendiente>({ id: "fecha_pago", header: "Fecha pago", accessor: (r) => r.fecha_pago }),
      meta: { width: COL_W.fecha, className: "text-xs whitespace-nowrap" },
    },
    {
      ...moneyColumn<FilaRepPendiente>({
        id: "monto", header: "Monto",
        accessor: (r) => r.monto, currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap font-medium" },
    },
    {
      id: "estado",
      header: "Estado REP",
      accessorFn: (r) => r.estado_rep,
      enableSorting: true,
      meta: { width: COL_W.folio },
      cell: ({ row }) => <Badge variant={badgeTone(row.original.estado_rep)}>{row.original.estado_rep}</Badge>,
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      meta: { width: COL_W.acciones, align: "right" },
      cell: ({ row }) => {
        const enProceso = o.pagoEnProceso === row.original.id;
        return (
          <div data-no-row-nav onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              disabled={o.bloqueado}
              onClick={() => o.onTimbrar(row.original.id)}
              aria-label={`Timbrar REP de la factura ${row.original.factura_numero}`}
            >
              {enProceso ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ReceiptText className="mr-2 h-3.5 w-3.5" />
              )}
              Timbrar REP
            </Button>
          </div>
        );
      },
    },
  ]);
}
