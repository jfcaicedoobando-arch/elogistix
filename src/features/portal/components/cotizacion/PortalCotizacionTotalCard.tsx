import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  conceptosCount: number;
  subtotal: number | string | null | undefined;
  moneda: string | null | undefined;
}

/**
 * VT-26: cotizaciones legacy sin desglose de conceptos mostraban el detalle sin
 * ningún importe. Cuando no hay conceptos parseables pero sí subtotal, se
 * muestra al menos el total cotizado.
 */
export default function PortalCotizacionTotalCard({ conceptosCount, subtotal, moneda }: Props) {
  const monto = Number(subtotal ?? 0);
  if (conceptosCount > 0 || !(monto > 0)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total cotizado</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-base font-bold tabular-nums">{formatCurrency(monto, moneda ?? "MXN")}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Monto total de la cotización. El desglose de conceptos no está disponible en esta cotización.
        </p>
      </CardContent>
    </Card>
  );
}
