import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { getEstadoColor, getEstadoBarColor } from "@/lib/ui/uiMappings";

interface Props {
  total: number;
  distribucion: Array<[string, number]>;
}

export function PortalEstadoEmbarquesCard({ total, distribucion }: Props) {
  if (total === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          Estado de Embarques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {distribucion.map(([estado, count]) => (
          <Link
            key={estado}
            to={`/portal/embarques?estado=${encodeURIComponent(estado)}`}
            className="flex items-center justify-between text-sm rounded-md px-1 -mx-1 py-0.5 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Filtrar embarques por ${estado} (${count})`}
          >
            <div className="flex items-center gap-2">
              <Badge className={`${getEstadoColor(estado)} text-xs`}>{estado}</Badge>
            </div>
            <span className="text-muted-foreground font-medium tabular-nums">{count}</span>
          </Link>
        ))}
        <div className="flex h-2.5 rounded-full overflow-hidden mt-2" role="img" aria-label="Distribución de embarques por estado">
          {distribucion.map(([estado, count]) => {
            const pct = (count / total) * 100;
            return (
              <Link
                key={estado}
                to={`/portal/embarques?estado=${encodeURIComponent(estado)}`}
                className={`${getEstadoBarColor(estado)} transition-all hover:opacity-80`}
                style={{ width: `${pct}%` }}
                title={`${estado}: ${count}`}
                aria-label={`Filtrar por ${estado}`}
              />
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center tabular-nums">
          {total} embarque{total !== 1 ? "s" : ""} activo{total !== 1 ? "s" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
