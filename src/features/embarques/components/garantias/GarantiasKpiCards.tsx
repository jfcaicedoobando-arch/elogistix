import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  totalDeposito: number;
  totalPendiente: number;
  count: number;
  diasPromRecuperacion: number | null;
}

export function GarantiasKpiCards({ totalDeposito, totalPendiente, count, diasPromRecuperacion }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="border-l-4 border-l-info">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Depósito total</p>
          <p className="text-lg font-bold tabular-nums mt-1">{formatCurrency(totalDeposito, 'USD')}</p>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-warning">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Por recuperar</p>
          <p className="text-lg font-bold tabular-nums mt-1">{formatCurrency(totalPendiente, 'USD')}</p>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-success">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Contenedores</p>
          <p className="text-lg font-bold tabular-nums mt-1">{count}</p>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Días prom. recuperación</p>
          <p className="text-lg font-bold tabular-nums mt-1">
            {diasPromRecuperacion !== null ? `${diasPromRecuperacion} d` : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
