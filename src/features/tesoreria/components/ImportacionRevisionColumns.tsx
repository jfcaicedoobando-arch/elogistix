import { Badge } from "@/components/ui/badge";
import { defineColumns } from "@/components/shared/DataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { FilaRevisionImportacion } from "@/features/tesoreria/domain/import/revisionImportacion";

export function columnasRevisionImportacion(moneda: string) {
  return defineColumns<FilaRevisionImportacion>([
    { id: "fecha", header: "Fecha", accessorFn: (r) => r.movimiento.fecha,
      cell: ({ row }) => formatDate(row.original.movimiento.fecha) },
    { id: "concepto", header: "Concepto / referencia", accessorFn: (r) => r.movimiento.concepto,
      cell: ({ row }) => <div className="max-w-xs text-body-sm"><p>{row.original.movimiento.concepto}</p>
        <p className="text-muted-foreground">{row.original.movimiento.referencia || "Sin referencia"}</p></div> },
    { id: "cargo", header: "Cargo", accessorFn: (r) => r.movimiento.cargo, meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.movimiento.cargo, moneda)}</span> },
    { id: "abono", header: "Abono", accessorFn: (r) => r.movimiento.abono, meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.movimiento.abono, moneda)}</span> },
    { id: "estado", header: "Revisión", accessorFn: (r) => r.estado,
      cell: ({ row }) => <div className="text-body-sm space-y-1"><Badge variant="outline">{row.original.estado}</Badge>
        {row.original.espejo && <p>Cobro existente {row.original.espejo.pago_factura_id?.slice(0, 8)} · {formatDate(row.original.espejo.fecha)}</p>}
        {row.original.estado === "Ambigua" && <p className="text-warning">{row.original.coincidencias} coincidencias; se importa sin vínculo.</p>}
      </div> },
  ]);
}
