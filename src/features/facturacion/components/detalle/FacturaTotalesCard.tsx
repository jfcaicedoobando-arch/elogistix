/**
 * FacturaTotalesCard — bloque destacado con Subtotal / IVA / Total.
 * Extraído de `FacturaResumenCard` para dar peso visual a los importes y
 * dejar la card de "Datos generales" enfocada en identificación.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  subtotal: number;
  iva: number;
  total: number;
  moneda: string;
}

export function FacturaTotalesCard({ subtotal, iva, total, moneda }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Totales</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          <Cell label="Subtotal" value={formatCurrency(subtotal, moneda)} />
          <Cell label="IVA" value={formatCurrency(iva, moneda)} />
          <Cell label="Total" value={formatCurrency(total, moneda)} highlight />
        </div>
      </CardContent>
    </Card>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-3 ${highlight ? "bg-accent/5 border-accent/40 ring-1 ring-accent/20" : ""}`}>
      <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-base font-semibold tabular-nums ${highlight ? "text-accent" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
