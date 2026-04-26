import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
          <div key={estado} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Badge className={`${getEstadoColor(estado)} text-xs`}>{estado}</Badge>
            </div>
            <span className="text-muted-foreground font-medium">{count}</span>
          </div>
        ))}
        <div className="flex h-2.5 rounded-full overflow-hidden mt-2">
          {distribucion.map(([estado, count]) => {
            const pct = (count / total) * 100;
            return (
              <div
                key={estado}
                className={`${getEstadoBarColor(estado)} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${estado}: ${count}`}
              />
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {total} embarque{total !== 1 ? "s" : ""} activo{total !== 1 ? "s" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
