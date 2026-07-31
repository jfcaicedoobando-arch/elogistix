import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { KpiCard } from "@/components/shared/KpiCard";
import { PackageCheck, Anchor, ChevronRight } from "lucide-react";
import { useEmbarquesPendientesAdmin } from "@/features/dashboard/hooks/useEmbarquesPendientesAdmin";
import { DrilldownRow } from "@/components/shared/dataTable/DrilldownRow";

interface Props {
  enabled: boolean;
}

export function EmbarquesPendientesAdminCard({ enabled }: Props) {
  const { data, isLoading } = useEmbarquesPendientesAdmin(enabled);
  if (!enabled) return null;

  const entregados = data?.entregadosCount ?? 0;
  const eir = data?.eirCount ?? 0;
  const porLiquidar = data?.porLiquidarCount ?? 0;
  const items = data?.topAntiguos ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Embarques pendientes administrativos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <KpiCard
            icon={PackageCheck}
            label="Entregados"
            sublabel="Esperan cierre"
            value={entregados}
            variant="success"
            loading={isLoading}
          />
          <KpiCard
            icon={Anchor}
            label="En EIR"
            sublabel="Último paso marítimo"
            value={eir}
            variant="warning"
            loading={isLoading}
          />
          <KpiCard
            icon={Wallet}
            label="Por liquidar"
            sublabel="Falta cobrar o pagar"
            value={porLiquidar}
            variant="warning"
            loading={isLoading}
          />
        </div>


        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Top 10 más antiguos
          </p>
          {isLoading ? (
            <ListSkeleton rows={3} />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay embarques pendientes 🎉
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {items.map((it) => (
                <DrilldownRow
                  key={it.id}
                  as="li"
                  href={`/embarques/${it.id}`}
                  ariaLabel={`Abrir embarque ${it.expediente ?? it.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{it.expediente ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {it.cliente_nombre}
                    </p>
                  </div>
                  <Badge
                    variant={it.estado === "EIR" ? "outline" : "secondary"}
                    className={
                      it.estado === "EIR"
                        ? "border-state-eir/40 text-state-eir"
                        : "bg-success/10 text-success hover:bg-success/10"
                    }
                  >
                    {it.estado}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                    {it.diasEnEstado} d
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                </DrilldownRow>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
