/** Tarjeta de ficha: letra, puntaje y cuántos puntos dio cada criterio. */
import { Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { usePuntajeDetalle } from "@/features/crm/hooks/useScoringCrm";
import type { ObjetoPuntaje } from "@/features/crm/services/scoring/scoringCrm";
import { InsigniaPuntaje } from "./InsigniaPuntaje";

interface Props { objeto: ObjetoPuntaje; registroId: string }

export function DesglosePuntajeCard({ objeto, registroId }: Props) {
  const { data, isLoading, isError, refetch } = usePuntajeDetalle(objeto, registroId);
  const resultado = isLoading || isError ? undefined : data;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-h4"><Gauge className="size-4" /> Puntaje</CardTitle>
        {data && <InsigniaPuntaje letra={data.letra} puntaje={data.puntaje} />}
      </CardHeader>
      <CardContent className="space-y-1 text-body-sm">
        {isLoading && <EmptyStateInline loading message="Calculando…" density="compact" />}
        {isError && <ErrorStateInline message="No se pudo calcular el puntaje." onRetry={() => void refetch()} />}
        {resultado?.cerrada && <EmptyStateInline message="Las oportunidades cerradas no se califican." density="compact" />}
        {resultado && !resultado.cerrada && resultado.desglose.length === 0 && (
          <EmptyStateInline message="Aún no hay criterios configurados." density="compact" />
        )}
        {resultado && !resultado.cerrada && resultado.desglose.map((c) => (
          <div key={c.criterio} className="flex justify-between gap-2">
            <span>{c.criterio}</span>
            <span className={c.puntos === 0 ? "text-muted-foreground" : "tabular-nums"}>
              {c.puntos === 0 ? `Sin capturar o sin cumplir (0 de ${c.maximo})` : `${c.puntos} de ${c.maximo}`}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
