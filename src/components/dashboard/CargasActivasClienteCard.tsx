import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import type { EstadoFiltro } from "@/hooks/dashboard/useDashboardData";

export interface CargaCliente {
  clienteId: string;
  clienteNombre: string;
  total: number;
  desglose: Record<EstadoFiltro, number>;
}

interface Props {
  data: CargaCliente[];
  isLoading: boolean;
}

const ESTADOS_ORDEN: EstadoFiltro[] = [
  "En Tránsito",
  "Confirmado",
  "Arribo",
  "En Aduana",
  "Entregado",
];

export const CargasActivasClienteCard = memo(function CargasActivasClienteCard({ data, isLoading }: Props) {
  const navigate = useNavigate();
  const maxTotal = data.length > 0 ? data[0].total : 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          Cargas activas por cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Sin embarques activos
          </p>
        ) : (
          data.map((c) => (
            <div
              key={c.clienteId}
              onClick={() => navigate(`/clientes/${c.clienteId}`)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer hover:bg-primary/5 transition-colors group"
            >
              {/* Total — big number */}
              <span className="text-2xl font-bold tabular-nums min-w-[2.5rem] text-right text-foreground">
                {c.total}
              </span>

              {/* Client name + chips */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                  {c.clienteNombre}
                </p>
                <div className="flex flex-wrap gap-1">
                  {ESTADOS_ORDEN.map((est) => {
                    const count = c.desglose?.[est];
                    if (!count) return null;
                    return (
                      <Badge
                        key={est}
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 leading-4 ${getEstadoColor(est)}`}
                      >
                        {count} {est}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Proportion bar */}
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <div className="w-24 h-2.5 rounded-full bg-secondary border border-border/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(8, (c.total / maxTotal) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums w-9 text-right">
                  {Math.round((c.total / maxTotal) * 100)}%
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
});
