/**
 * FacturaTotalesCard — bloque destacado con Subtotal / IVA / Total.
 * v13.302.6: migrado al `MoneyCell` canónico para evitar overflow en móvil 402 px.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { MoneyCell } from "@/components/shared/MoneyCell";

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
          <MoneyCell label="Subtotal" value={formatCurrency(subtotal, moneda)} />
          <MoneyCell label="IVA" value={formatCurrency(iva, moneda)} />
          <MoneyCell label="Total" value={formatCurrency(total, moneda)} highlight />
        </div>
      </CardContent>
    </Card>
  );
}
