import { memo } from "react";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import type { AlertaDemora } from "@/features/dashboard/hooks";
import { toTitleCase } from "@/lib/formatters";
import { activableConTeclado, FOCUS_RING } from "@/lib/ui/keyboardActivation";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Hint } from "@/components/shared/Hint";
import {
  DashboardListaVerMas,
  MAX_ITEMS_TARJETA_DASHBOARD,
} from "@/features/dashboard/components/DashboardListaVerMas";

interface Props {
  alertas: AlertaDemora[];
  isLoading: boolean;
}

/**
 * R8: un badge "0d" no comunica nada. Con 0 días de demora la carga se venció
 * hoy, así que lo decimos con palabras.
 */
function etiquetaDemora(dias: number): { badge: string; titulo: string } {
  if (dias <= 0) return { badge: "Hoy", titulo: "Se vence hoy" };
  return { badge: `${dias}d`, titulo: `${dias} ${dias === 1 ? "día" : "días"} de demora` };
}

/**
 * v13.779.0 · El conteo usa la fecha real de descarga y los días libres de la
 * naviera. Cuando aún no hay descarga capturada, se estima con la ETA y hay que
 * decirlo: es la diferencia entre el tablero y lo que se factura.
 */
function detalleBase(e: AlertaDemora): string {
  const libres = e.diasLibres ?? 7;
  const base = e.baseDemora === "real" ? "descarga real" : "ETA (estimado)";
  return `${libres} ${libres === 1 ? "día libre" : "días libres"} · base: ${base}`;
}


export const AlertasDemoraCard = memo(function AlertasDemoraCard({ alertas, isLoading }: Props) {
  const navigate = useNavigate();

  function renderBody() {
    if (isLoading) {
      return <ListSkeleton rows={3} />;
    }
    if (alertas.length === 0) {
      return (
        <EmptyStateInline icon={ShieldCheck} message="Sin alertas de demora" className="py-6" />
      );
    }
    return alertas.slice(0, MAX_ITEMS_TARJETA_DASHBOARD).map((e) => (
            <div
              key={e.id}
              {...activableConTeclado(() => navigate(`/embarques/${e.id}`))}
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors ${FOCUS_RING}`}
            >
              <Hint label={`${etiquetaDemora(e.diasDemora).titulo} — ${detalleBase(e)}`}>
                <div
                  className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-label font-bold text-primary-foreground ${
                    e.diasDemora >= 5 ? "bg-destructive" : "bg-warning"
                  }`}
                >
                  {etiquetaDemora(e.diasDemora).badge}
                </div>
              </Hint>

              <div className="min-w-0 flex-1">
                <p className="text-body font-medium truncate">{e.expediente}</p>
                <p className="text-body-sm text-muted-foreground truncate">
                  {toTitleCase(e.cliente_nombre)}
                  {e.baseDemora === "estimada" && (
                    <span className="ml-1.5 text-label text-warning">· estimado por ETA</span>
                  )}
                </p>
              </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    ));
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Alertas de Demora
          {alertas.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-label">
              {alertas.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {renderBody()}
        {!isLoading && <DashboardListaVerMas total={alertas.length} ruta="/embarques" etiqueta="embarques" />}
      </CardContent>
    </Card>
  );
});
