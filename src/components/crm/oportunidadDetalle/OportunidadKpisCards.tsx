import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyCompact } from "@/lib/formatters";

interface Etapa {
  id: string;
  nombre: string;
  color?: string | null;
}

interface Props {
  etapa: Etapa | undefined;
  montoEstimado: number;
  valorReal: number | null;
  probabilidad: number;
  moneda: string;
}

function ValorCard({ valorReal, montoEstimado, probabilidad, moneda }: Omit<Props, "etapa">) {
  const esCerrado = valorReal != null;
  const valor = esCerrado ? valorReal : montoEstimado * (probabilidad / 100);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{esCerrado ? "Valor real" : "Ponderado"}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold">
        {formatCurrencyCompact(Number(valor ?? 0), moneda)}
        <div className="text-xs text-muted-foreground">
          {esCerrado ? "Cerrado" : `${probabilidad}% probabilidad`}
        </div>
      </CardContent>
    </Card>
  );
}

export function OportunidadKpisCards({ etapa, montoEstimado, valorReal, probabilidad, moneda }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Etapa</CardTitle></CardHeader>
        <CardContent><Badge style={{ backgroundColor: etapa?.color ?? undefined }}>{etapa?.nombre ?? "—"}</Badge></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Monto estimado</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">{formatCurrencyCompact(montoEstimado, moneda)}</CardContent>
      </Card>
      <ValorCard valorReal={valorReal} montoEstimado={montoEstimado} probabilidad={probabilidad} moneda={moneda} />
    </div>
  );
}
