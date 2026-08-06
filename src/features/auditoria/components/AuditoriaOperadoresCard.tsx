/**
 * Tarjetas de productividad de operadores: MTTR + ranking dual.
 *
 * Bloque 3 auditoría (13.21.24): el ranking se separa en dos tabs:
 *  - "Responsables": quién tiene asignado el hallazgo (carga de trabajo).
 *  - "Revisores": quién marcó "revisado" (productividad de resolución).
 *
 * Antes ambos roles se mezclaban bajo una sola clave y producía métricas
 * ambiguas cuando A asignaba y B resolvía.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Timer } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import type { OperadorRanking } from "@/features/auditoria/hooks";

interface Props {
  mttrHoras: number | null;
  ranking: OperadorRanking[];
  /** Opcional: si se provee, se muestran ambos rankings en tabs. */
  rankingRevisores?: OperadorRanking[];
}

function formatMttr(horas: number | null | undefined): string {
  if (horas == null || !Number.isFinite(horas) || horas <= 0) return "Sin datos";
  if (horas < 24) return `${horas} h`;
  const dias = Math.round(horas / 24);
  return `${dias} d`;
}

function RankingList({ ranking, emptyMsg }: { ranking: OperadorRanking[]; emptyMsg: string }) {
  if (ranking.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-6 text-center">{emptyMsg}</div>
    );
  }
  return (
    <div className="space-y-2">
      {ranking.map((op) => (
        <div
          key={op.email}
          className="flex items-center justify-between gap-2 text-xs border rounded-md p-2"
        >
          <span className="truncate font-medium" title={op.email}>{op.email}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="secondary" className="tabular-nums">{op.resueltos} resueltos</Badge>
            {op.pendientes > 0 && (
              <Badge variant="outline" className="tabular-nums">{op.pendientes} pend.</Badge>
            )}
            {op.vencidos > 0 && (
              <Badge variant="destructive" className="tabular-nums">{op.vencidos} venc.</Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuditoriaOperadoresCard({ mttrHoras, ranking, rankingRevisores }: Props) {
  const tieneTabs = rankingRevisores !== undefined;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <KpiCard
        label="Tiempo medio de resolución"
        value={formatMttr(mttrHoras)}
        icon={Timer}
        sublabel="Desde detección del hallazgo hasta marca de revisado."
      />

      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Productividad de operadores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tieneTabs ? (
            <Tabs defaultValue="responsables">
              <TabsList className="h-8">
                <TabsTrigger value="responsables" className="text-xs">Responsables</TabsTrigger>
                <TabsTrigger value="revisores" className="text-xs">Revisores</TabsTrigger>
              </TabsList>
              <TabsContent value="responsables" className="mt-2">
                <RankingList
                  ranking={ranking}
                  emptyMsg="Aún no hay responsables asignados."
                />
              </TabsContent>
              <TabsContent value="revisores" className="mt-2">
                <RankingList
                  ranking={rankingRevisores!}
                  emptyMsg="Aún no hay hallazgos resueltos."
                />
              </TabsContent>
            </Tabs>
          ) : (
            <RankingList
              ranking={ranking}
              emptyMsg="Aún no hay actividad de operadores registrada."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
