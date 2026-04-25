import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { Tables } from "@/integrations/supabase/types";
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="text-right">P. Unit.</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead>Moneda</TableHead>
              <TableHead className="text-center">IVA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conceptosSeleccionados.map(c => {
              const sub = Number(c.cantidad) * Number(c.precio_unitario);
              const aplicaIva = c.moneda === "MXN" ? true : !!ivaPorConcepto[c.id];
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.descripcion}</TableCell>
                  <TableCell className="text-right">{c.cantidad}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(c.precio_unitario), c.moneda)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(sub, c.moneda)}</TableCell>
                  <TableCell>{c.moneda}</TableCell>
                  <TableCell className="text-center">
                    {aplicaIva ? (
                      <Badge variant="success" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-0.5" /> Sí
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">No</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground">Ejecutivo de Operaciones</p>
          <p className="font-semibold mt-0.5">{operadorEmbarque || "—"}</p>
        </div>
        <div className="rounded-md border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground">Días de crédito</p>
          <p className="font-semibold mt-0.5">
            {diasCredito.trim() === "" ? "—" : Number(diasCredito) === 0 ? "Contado" : `${diasCredito} días`}
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
