import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getEstadoColor, getEstadoBarColor } from "@/lib/ui/uiMappings";
import { pluralS } from "@/lib/formatters";
import { useDrilldownRow } from "@/components/shared/dataTable/useDrilldownRow";
import { cn } from "@/lib/utils";

interface Props {
  total: number;
  distribucion: Array<[string, number]>;
}

export function PortalEstadoEmbarquesCard({ total, distribucion }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          Estado de Embarques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            Sin embarques activos por ahora.
          </p>
        )}
        {distribucion.map(([estado, count]) => (
          <EstadoLegendRow key={estado} estado={estado} count={count} />
        ))}
        <div className="flex h-2.5 rounded-full overflow-hidden mt-2" role="img" aria-label="Distribución de embarques por estado">
          {distribucion.map(([estado, count]) => {
            const pct = (count / total) * 100;
            return (
              <EstadoBarSegment key={estado} estado={estado} count={count} pct={pct} />
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center tabular-nums">
          {total} embarque{pluralS(total)} activo{pluralS(total)}
        </p>
      </CardContent>
    </Card>
  );
}

function EstadoLegendRow({ estado, count }: { estado: string; count: number }) {
  const nav = useDrilldownRow({
    href: `/portal/embarques?estado=${encodeURIComponent(estado)}`,
    ariaLabel: `Filtrar embarques por ${estado} (${count})`,
  });
  return (
    <div
      {...nav}
      className={cn(nav.className, "flex items-center justify-between text-sm rounded-md px-1 -mx-1 py-0.5 hover:bg-muted/50 transition-colors")}
    >
      <div className="flex items-center gap-2">
        <Badge className={`${getEstadoColor(estado)} text-xs`}>{estado}</Badge>
      </div>
      <span className="text-muted-foreground font-medium tabular-nums">{count}</span>
    </div>
  );
}

function EstadoBarSegment({ estado, count, pct }: { estado: string; count: number; pct: number }) {
  const nav = useDrilldownRow({
    href: `/portal/embarques?estado=${encodeURIComponent(estado)}`,
    ariaLabel: `Filtrar por ${estado}`,
  });
  return (
    <div
      {...nav}
      className={cn(nav.className, getEstadoBarColor(estado), "transition-all hover:opacity-80 rounded-sm")}
      style={{ width: `${pct}%` }}
      title={`${estado}: ${count}`}
    />
  );
}
