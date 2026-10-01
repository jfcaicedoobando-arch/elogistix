import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatFechaEs } from "@/lib/formatters/dates";
import type { VencidosFueraProyeccion } from "../domain/vencidosFueraProyeccion";

export function AvisoVencidosFueraProyeccion({ resumen }: { resumen: VencidosFueraProyeccion }) {
  if (!resumen.entradas.cantidad && !resumen.salidas.cantidad) return null;
  const importes = (porMoneda: Record<string, number>) =>
    Object.entries(porMoneda).map(([m, saldo]) => formatCurrency(saldo, m)).join(" + ");
  return (
    <Alert variant="warning">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="space-y-2">
        <p className="font-medium">Vencidos fuera de esta proyección</p>
        <p>
          Los saldos con fecha anterior al {formatFechaEs(resumen.anteriores_a)} no se incluyen en las semanas ni en los totales.
          No tienen una nueva fecha de cobro o pago asignada por el sistema.
        </p>
        {resumen.entradas.cantidad > 0 && (
          <p>Cobranza: {resumen.entradas.cantidad} documento(s) · {importes(resumen.entradas.por_moneda)}</p>
        )}
        {resumen.salidas.cantidad > 0 && (
          <p>Pagos y comisiones: {resumen.salidas.cantidad} documento(s) · {importes(resumen.salidas.por_moneda)}.
            Las facturas pendientes de aprobación también pueden estar incluidas.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {resumen.entradas.cantidad > 0 && <Button asChild variant="outline" size="sm"><Link to="/cobranza">Revisar cobranza</Link></Button>}
          {resumen.salidas.cantidad > 0 && <Button asChild variant="outline" size="sm"><Link to="/tesoreria/pagos-programados">Revisar pagos programados</Link></Button>}
        </div>
      </AlertDescription>
    </Alert>
  );
}
