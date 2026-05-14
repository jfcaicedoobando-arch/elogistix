import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/DataTable";
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
          columns={[
            { key: "desc", header: "Descripción", className: "font-medium", render: (c) => c.descripcion },
            { key: "cant", header: "Cant.", align: "right", className: "tabular-nums", render: (c) => c.cantidad },
            { key: "pu", header: "P. Unit.", align: "right", className: "tabular-nums", render: (c) => formatCurrency(Number(c.precio_unitario), c.moneda) },
            { key: "sub", header: "Subtotal", align: "right", className: "font-semibold tabular-nums",
              render: (c) => formatCurrency(Number(c.cantidad) * Number(c.precio_unitario), c.moneda) },
            { key: "moneda", header: "Moneda", render: (c) => c.moneda },
            { key: "iva", header: "IVA", align: "center",
              render: (c) => {
                const aplica = c.moneda === "MXN" ? true : !!ivaPorConcepto[c.id];
                return aplica
                  ? <Badge variant="success" className="text-xs"><CheckCircle2 className="h-3 w-3 mr-0.5" /> Sí</Badge>
                  : <Badge variant="secondary" className="text-xs">No</Badge>;
              } },
          ]}
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
