import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageCheck, Anchor, ChevronRight } from "lucide-react";
import { useEmbarquesPendientesAdmin } from "@/features/dashboard/hooks/useEmbarquesPendientesAdmin";

interface Props {
  enabled: boolean;
}

export function EmbarquesPendientesAdminCard({ enabled }: Props) {
  const { data, isLoading } = useEmbarquesPendientesAdmin(enabled);
  if (!enabled) return null;

  const entregados = data?.entregadosCount ?? 0;
  const eir = data?.eirCount ?? 0;
  const items = data?.topAntiguos ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Embarques pendientes administrativos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <KpiTile
            icon={<PackageCheck className="h-4 w-4 text-emerald-600" />}
            label="Entregados"
            sublabel="Esperan cierre"
            value={entregados}
            loading={isLoading}
          />
          <KpiTile
            icon={<Anchor className="h-4 w-4 text-orange-600" />}
            label="En EIR"
            sublabel="Último paso marítimo"
            value={eir}
            loading={isLoading}
          />
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Top 10 más antiguos
          </p>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay embarques pendientes 🎉
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {items.map((it) => (
                <li key={it.id}>
                  <Link
                    to={`/embarques/${it.id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/50 focus:bg-muted/50 focus:outline-none transition-colors"
                    aria-label={`Abrir embarque ${it.expediente ?? it.id}`}
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
                          ? "border-orange-300 text-orange-700"
                          : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                      }
                    >
                      {it.estado}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                      {it.diasEnEstado} d
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface KpiTileProps {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  value: number;
  loading: boolean;
}

function KpiTile({ icon, label, sublabel, value, loading }: KpiTileProps) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-12 mt-1" />
      ) : (
        <p className="text-2xl font-semibold tabular-nums mt-1">{value}</p>
      )}
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </div>
  );
}
