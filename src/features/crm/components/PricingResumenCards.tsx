/**
 * Tarjetas de pricing para el Resumen ejecutivo del CRM:
 * 1) Tiempo de respuesta de las solicitudes (promedio y % a tiempo).
 * 2) Cuántas solicitudes hay y en qué estatus.
 */
import { useResumenPricing } from "../hooks/useResumenPricing";
import { Clock, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { porcentajeEntero } from "@/lib/formatters";
import { formatoHorasRespuesta } from "@/features/crm/services/pricing/resumenPricing";

export function PricingResumenCards() {
  const { data, isLoading, isError, refetch } = useResumenPricing();

  const cuerpo = (children: React.ReactNode) => (
    <>
      {isError ? (
        <ErrorStateInline message="No se pudo cargar el resumen de pricing." onRetry={refetch} />
      ) : isLoading ? (
        <EmptyStateInline loading message="Cargando…" />
      ) : (
        children
      )}
    </>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            Tiempo de respuesta de pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cuerpo(
            !data || data.respondidas === 0 ? (
              <EmptyStateInline icon={Clock} message="Aún no hay solicitudes respondidas." />
            ) : (
              <div className="space-y-2">
                <p className="text-2xl font-semibold tabular-nums">
                  {formatoHorasRespuesta(data.horasPromedioRespuesta ?? 0)}
                  <span className="text-body-sm font-normal text-muted-foreground"> promedio</span>
                </p>
                <p className="text-body-sm text-muted-foreground">
                  {data.respondidasATiempo} de {data.respondidas} respondidas dentro del plazo
                  {" "}({porcentajeEntero(data.respondidasATiempo, data.respondidas) ?? 0}%).
                </p>
              </div>
            ),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Inbox className="size-4 text-muted-foreground" />
            Solicitudes de pricing por estatus
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cuerpo(
            !data || data.total === 0 ? (
              <EmptyStateInline icon={Inbox} message="Sin solicitudes de pricing aún." />
            ) : (
              <ul className="space-y-2">
                {data.porEstado.map((e) => {
                  const pct = porcentajeEntero(e.cantidad, data.total, { minimo: 2 }) ?? 2;
                  return (
                    <li key={e.estado} className="space-y-1">
                      <div className="flex justify-between text-body">
                        <span className="truncate">{e.etiqueta}</span>
                        <span className="font-semibold tabular-nums">{e.cantidad}</span>
                      </div>
                      <div className="h-2 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
                <li className="pt-1 text-body-sm text-muted-foreground">
                  Total: {data.total} solicitudes (sin borradores).
                </li>
              </ul>
            ),
          )}
        </CardContent>
      </Card>
    </div>
  );
}
