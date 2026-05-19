import { Badge } from "@/components/ui/badge";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDiasCredito } from "@/lib/formatters";
import type { Tables } from "@/types/db";
import type { TotalesProforma } from "./PasoSeleccionConceptos";

type ConceptoVenta = Tables<"conceptos_venta">;

interface Props {
  conceptosSeleccionados: ConceptoVenta[];
  ivaPorConcepto: Record<string, boolean>;
  totales: TotalesProforma;
  tasaIva: number;
  notas: string;
  diasCredito: string;
  operadorEmbarque: string | null;
}

export function PasoConfirmacionProforma({
  conceptosSeleccionados, ivaPorConcepto, totales, tasaIva, notas, diasCredito, operadorEmbarque,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-warning/10 border-warning/30 p-3 text-sm">
        <p className="[color:hsl(var(--warning))]">
          <strong>Importante:</strong> Aún no se ha guardado nada. Revisa el resumen y confirma para generar la proforma y descargar el PDF.
        </p>
      </div>

      <div className="border rounded-md overflow-hidden">
        <div className="bg-muted/50 px-3 py-2 border-b">
          <h4 className="text-sm font-semibold">Conceptos incluidos ({conceptosSeleccionados.length})</h4>
        </div>
        <DataTable<ConceptoVenta>
          columns={defineColumns<ConceptoVenta>([
            { id: "desc", header: "Descripción", meta: { className: "font-medium" }, cell: ({ row }) => row.original.descripcion },
            { id: "cant", header: "Cant.", meta: { className: "text-right tabular-nums", headerClassName: "text-right" }, cell: ({ row }) => row.original.cantidad },
            { id: "pu", header: "P. Unit.", meta: { className: "text-right tabular-nums", headerClassName: "text-right" }, cell: ({ row }) => formatCurrency(Number(row.original.precio_unitario), row.original.moneda) },
            { id: "sub", header: "Subtotal", meta: { className: "text-right font-semibold tabular-nums", headerClassName: "text-right" },
              cell: ({ row }) => formatCurrency(Number(row.original.cantidad) * Number(row.original.precio_unitario), row.original.moneda) },
            { id: "moneda", header: "Moneda", cell: ({ row }) => row.original.moneda },
            { id: "iva", header: "IVA", meta: { className: "text-center", headerClassName: "text-center" },
              cell: ({ row }) => {
                const c = row.original;
                const aplica = c.moneda === "MXN" ? true : !!ivaPorConcepto[c.id];
                return aplica
                  ? <Badge variant="success" className="text-xs"><CheckCircle2 className="h-3 w-3 mr-0.5" /> Sí</Badge>
                  : <Badge variant="secondary" className="text-xs">No</Badge>;
              } },
          ]) as ColumnDef<ConceptoVenta, unknown>[]}
          data={conceptosSeleccionados}
          rowKey={(c) => c.id}
          density="compact"
        />

      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground">Ejecutivo de Operaciones</p>
          <p className="font-semibold mt-0.5">{operadorEmbarque || "—"}</p>
        </div>
        <div className="rounded-md border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground">Días de crédito</p>
          <p className="font-semibold mt-0.5">
            {formatDiasCredito(diasCredito)}
          </p>
        </div>
      </div>

      <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
        <h4 className="font-semibold text-sm mb-2">Totales finales</h4>
        {totales.subtotal_usd > 0 && (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal USD:</span><span>{formatCurrency(totales.subtotal_usd, "USD")}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>IVA USD:</span><span>{formatCurrency(totales.iva_usd, "USD")}</span></div>
            <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total USD:</span><span>{formatCurrency(totales.total_usd, "USD")}</span></div>
          </div>
        )}
        {totales.subtotal_mxn > 0 && (
          <div className={`space-y-1 text-sm ${totales.subtotal_usd > 0 ? "mt-3 pt-3 border-t" : ""}`}>
            <div className="flex justify-between"><span>Subtotal MXN:</span><span>{formatCurrency(totales.subtotal_mxn, "MXN")}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>IVA ({(tasaIva * 100).toFixed(0)}%) MXN:</span><span>{formatCurrency(totales.iva_mxn, "MXN")}</span></div>
            <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total MXN:</span><span>{formatCurrency(totales.total_mxn, "MXN")}</span></div>
          </div>
        )}
      </div>

      {notas.trim() && (
        <div className="rounded-md border p-3 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Notas:</p>
          <p className="text-sm whitespace-pre-wrap">{notas}</p>
        </div>
      )}
    </div>
  );
}
