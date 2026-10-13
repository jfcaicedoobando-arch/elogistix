import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { FilaVsReal } from "../services/vsRealDomain";
import { tieneGastoSinPresupuesto } from "../services/vsRealExcepciones";

export function AvisoGastoSinPresupuesto({ filas }: { filas: FilaVsReal[] }) {
  const sinBase = filas.filter(tieneGastoSinPresupuesto);
  if (sinBase.length === 0) return null;
  const importe = sinBase.reduce((total, fila) => total + fila.real_mxn, 0);
  return (
    <Card className="border-warning/50">
      <CardContent className="p-3 text-sm text-warning" role="status">
        Gasto positivo sin presupuesto: {formatCurrency(importe, "MXN")} en {sinBase.length}{" "}
        {sinBase.length === 1 ? "categoría" : "categorías"}. Incluye presupuestos cero y capturas ausentes.
        {" "}El porcentaje no aplica. Se muestra en "Solo excepciones", separado del conteo de categorías en exceso del 110%.
      </CardContent>
    </Card>
  );
}
