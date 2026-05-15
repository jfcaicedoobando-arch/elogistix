import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  totalActivosGlobal: number;
}

const ESTADOS_ORDEN: EstadoFiltro[] = [
  "En Tránsito",
  "Confirmado",
  "Arribo",
  "En Aduana",
  "Entregado",
];

const ESTADOS_TEXTO = ESTADOS_ORDEN.join(" · ");

function sumDesglose(desglose: CargaCliente["desglose"]): number {
  return ESTADOS_ORDEN.reduce((acc, est) => acc + (desglose?.[est] ?? 0), 0);
}

interface FilaProps {
  cliente: CargaCliente & { totalVisible: number };
  totalActivosGlobal: number;
  onClick: () => void;
}

function FilaCliente({ cliente: c, totalActivosGlobal, onClick }: FilaProps) {
  const hasGlobal = totalActivosGlobal > 0;
  const pct = hasGlobal ? (c.totalVisible / totalActivosGlobal) * 100 : 0;
  const pctRedondeado = Math.round(pct);
  const ariaLabel = hasGlobal
    ? `${c.clienteNombre}: ${c.totalVisible} de ${totalActivosGlobal} cargas activas, ${pctRedondeado} por ciento del total`
    : `${c.clienteNombre}: ${c.totalVisible} cargas activas`;

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div
          onClick={onClick}
          aria-label={ariaLabel}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer hover:bg-primary/5 transition-colors group"
        >
          {/* Total — big number (suma exacta de los chips) */}
          <span className="text-2xl font-bold tabular-nums min-w-[2.5rem] text-right text-foreground">
            {c.totalVisible}
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

          {/* Proportion bar — % sobre el total activo de TODOS los clientes */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <div className="w-24 h-2.5 rounded-full bg-secondary border border-border/40 overflow-hidden">
              {hasGlobal ? (
                <div
                  className="h-full rounded-full bg-primary transition-all min-w-[4px]"
                  style={{ width: `${pct}%` }}
                />
              ) : null}
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap text-right">
              {hasGlobal ? (
                <>
                  {pctRedondeado}%<span className="hidden md:inline"> del total</span>
                </>
              ) : (
                "—"
              )}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" collisionPadding={16} className="max-w-xs">
        <p className="font-semibold mb-1">{c.clienteNombre}</p>
        {hasGlobal ? (
          <p className="text-xs">
            <span className="font-medium">{c.totalVisible}</span> de{" "}
            <span className="font-medium">{totalActivosGlobal}</span> cargas activas{" "}
            <span className="text-muted-foreground">({pctRedondeado}% del total de tu organización)</span>
          </p>
        ) : (
          <p className="text-xs">{c.totalVisible} cargas activas</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
          Incluye embarques en: {ESTADOS_TEXTO}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export const CargasActivasClienteCard = memo(function CargasActivasClienteCard({ data, isLoading, totalActivosGlobal }: Props) {
  const navigate = useNavigate();

  // Filtramos clientes cuya suma de chips visibles sea > 0 (evita filas con número grande sin chips).
  const filas = data
    .map((c) => ({ ...c, totalVisible: sumDesglose(c.desglose) }))
    .filter((c) => c.totalVisible > 0);

  function renderBody() {
    if (isLoading) {
      return Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ));
    }
    if (filas.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-6">
          Sin embarques activos
        </p>
      );
    }
    return filas.map((c) => (
      <FilaCliente
        key={c.clienteId}
        cliente={c}
        totalActivosGlobal={totalActivosGlobal}
        onClick={() => navigate(`/clientes/${c.clienteId}`)}
      />
    ));
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Cargas activas por cliente
          </CardTitle>
          <p className="text-xs text-muted-foreground leading-snug">
            Suma de embarques en {ESTADOS_TEXTO}. El % de cada fila indica qué porción
            del total activo de tu organización representa ese cliente.
          </p>
        </CardHeader>
        <CardContent className="space-y-1 pt-0">{renderBody()}</CardContent>
      </Card>
    </TooltipProvider>
  );
});
