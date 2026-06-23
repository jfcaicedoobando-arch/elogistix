/**
 * Modal de revalidación de tarifa.
 * 3 modos según severidad:
 *   - sin_cambios → no debe mostrarse (caller decide).
 *   - informativa → tabla de deltas + botones Mantener / Refrescar.
 *   - bloqueante  → mensaje + botón "Solicitar re-aprobación a ventas".
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import type { ResultadoRevalidacion } from "@/features/cotizacion/domain/revalidacionTarifa";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  resultado: ResultadoRevalidacion | null;
  onMantener: () => void;
  onRefrescar: () => void;
  onSustituir?: () => void;
  onSolicitarReaprobacion: () => void;
  loading?: boolean;
}

const fmtMoney = (n: number | null, moneda: "USD" | "MXN"): string =>
  n == null ? "—" : formatCurrency(n, moneda);

export function RevalidarTarifaModal({
  open, onOpenChange, resultado,
  onMantener, onRefrescar, onSustituir, onSolicitarReaprobacion, loading,
}: Props) {
  if (!resultado) return null;
  const { severidad, cambios, tarifa_vigente, umbral_pct, max_delta_pct } = resultado;
  const esBloqueante = severidad === "bloqueante";

  const title = (
    <span className="flex items-center gap-2">
      {esBloqueante ? (
        <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
      ) : (
        <AlertTriangle className="h-4 w-4 text-yellow-600" aria-hidden />
      )}
      {esBloqueante
        ? "Tarifa requiere re-aprobación de ventas"
        : "Cambios menores en la tarifa vigente"}
    </span>
  );

  const description = !tarifa_vigente
    ? "La tarifa asociada a esta cotización ya no está vigente."
    : `Se detectaron cambios respecto a la tarifa cotizada (umbral configurado: ${umbral_pct}%, máximo observado: ${max_delta_pct}%).`;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ShieldCheck}
      title={title}
      description={description}
      size="2xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          {esBloqueante ? (
            <Button
              variant="default"
              onClick={onSolicitarReaprobacion}
              disabled={loading}
              aria-label="Solicitar re-aprobación a ventas"
            >
              Solicitar re-aprobación a ventas
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onMantener} disabled={loading}>
                Mantener costos cotizados
              </Button>
              {onSustituir && (
                <Button variant="outline" onClick={onSustituir} disabled={loading}>
                  Elegir otra tarifa…
                </Button>
              )}
              <Button onClick={onRefrescar} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" aria-hidden />
                Refrescar desde tarifa vigente
              </Button>
            </>
          )}
        </>
      }
    >
      {cambios.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2">Concepto</th>
                <th className="p-2 text-right">Cotizado</th>
                <th className="p-2 text-right">Vigente</th>
                <th className="p-2 text-right">Delta</th>
                <th className="p-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {cambios.map((c, i) => (
                <tr key={`${c.concepto}-${i}`} className="border-t">
                  <td className="p-2">
                    {c.concepto}
                    {c.motivo === "eliminado" && (
                      <Badge variant="destructive" className="ml-2">Eliminado</Badge>
                    )}
                  </td>
                  <td className="p-2 text-right">{fmtMoney(c.monto_anterior, c.moneda)}</td>
                  <td className="p-2 text-right">{fmtMoney(c.monto_actual, c.moneda)}</td>
                  <td className="p-2 text-right">{fmtMoney(c.delta_abs, c.moneda)}</td>
                  <td className="p-2 text-right">{c.delta_pct == null ? "—" : `${c.delta_pct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FormDialogShell>
  );
}
