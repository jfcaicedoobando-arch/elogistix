/**
 * Columnas de la bandeja "REPs" (histórico): complementos de pago ya
 * timbrados. Sólo lectura — las acciones son descarga de PDF/XML vía el
 * proxy `facturapi-descargar` (las URLs de FacturApi requieren API key).
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDown, FileCode, RefreshCw } from "lucide-react";

import { defineColumns } from "@/components/shared/DataTable";
import { Hint } from "@/components/shared/Hint";

import { clientColumn, moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { formatDate } from "@/lib/formatters";
import type { FilaRepHistorico } from "@/features/facturacion/hooks/useBandejas";

/** Estado derivado del REP, igual que en ConsultaRepsTable del detalle. */
export function estadoRepHistorico(r: Pick<FilaRepHistorico, "rep_cancellation_status">): string {
  const cs = (r.rep_cancellation_status ?? "none").toLowerCase();
  if (cs === "accepted") return "Cancelado";
  if (cs === "pending" || cs === "verifying") return "En cancelación";
  return "Timbrado";
}

interface Opts {
  onDescargar: (pagoId: string, tipo: "pdf" | "xml") => void;
  descargando: string | null;
}

export function buildRepsHistoricoColumns(o: Opts) {
  return defineColumns<FilaRepHistorico>([
    {
      id: "folio_rep",
      header: "Folio REP",
      accessorFn: (r) => r.folio_rep,
      enableSorting: true,
      meta: { width: COL_W.monto, className: "font-mono whitespace-nowrap", sticky: true },
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.folio_rep}</div>
          {row.original.uuid_rep && (
            <Hint label={row.original.uuid_rep}>
              <span
                tabIndex={0}
                aria-label={`UUID ${row.original.uuid_rep}`}
                className="block font-mono text-label text-muted-foreground truncate max-w-[180px]"
              >
                {row.original.uuid_rep}
              </span>
            </Hint>
          )}

        </div>
      ),
    },
    {
      id: "factura",
      header: "Factura",
      accessorFn: (r) => r.factura_numero,
      enableSorting: true,
      meta: { width: COL_W.monto, className: "font-mono whitespace-nowrap" },
      cell: ({ row }) => row.original.factura_numero,
    },
    clientColumn<FilaRepHistorico>({ accessor: (r) => r.cliente_nombre }),
    {
      ...dateColumn<FilaRepHistorico>({ id: "fecha_pago", header: "Fecha pago", accessor: (r) => r.fecha_pago }),
      meta: { width: COL_W.fecha, className: "text-body-sm whitespace-nowrap" },
    },
    {
      ...moneyColumn<FilaRepHistorico>({
        id: "monto", header: "Monto",
        accessor: (r) => r.monto, currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap font-medium" },
    },
    {
      id: "timbrado",
      header: "Timbrado",
      accessorFn: (r) => r.timbrado_rep_en ?? "",
      enableSorting: true,
      meta: { width: COL_W.fecha, className: "text-body-sm whitespace-nowrap" },
      cell: ({ row }) => (row.original.timbrado_rep_en ? formatDate(row.original.timbrado_rep_en) : "—"),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (r) => estadoRepHistorico(r),
      enableSorting: true,
      meta: { width: COL_W.folio },
      cell: ({ row }) => {
        const estado = estadoRepHistorico(row.original);
        const variant = estado === "Cancelado" ? "destructive" : estado === "En cancelación" ? "warning" : "outline";
        return <Badge variant={variant}>{estado}</Badge>;
      },
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      meta: { width: "w-[110px]", align: "right" },
      cell: ({ row }) => {
        const id = row.original.id;
        return (
          <div data-no-row-nav onClick={(e) => e.stopPropagation()} className="flex justify-end gap-1">
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              loading={o.descargando === `${id}:pdf`}
              onClick={() => o.onDescargar(id, "pdf")}
              aria-label={`Descargar PDF del REP ${row.original.folio_rep}`}
            >
              <FileDown className="size-4" />
            </Button>
            <Button
              size="icon" variant="outline" className="h-8 w-8"
              loading={o.descargando === `${id}:xml`}
              onClick={() => o.onDescargar(id, "xml")}
              aria-label={`Descargar XML del REP ${row.original.folio_rep}`}
            >
              <FileCode className="size-4" />
            </Button>
          </div>
        );
      },
    },
  ]);
}
