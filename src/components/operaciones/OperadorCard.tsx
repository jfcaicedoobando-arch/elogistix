import { memo, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { User, ChevronRight } from "lucide-react";
import type { OperadorData, EstadoUiKey } from "@/hooks/operaciones/useOperacionesData";
import { ESTADOS_KEYS } from "@/hooks/operaciones/useDesempenoChartData";
import { ESTADO_COLOR, ESTADO_ICON } from "./desempenoVisuals";
import { ClienteExpandible } from "./ClienteExpandible";
import { EmbarquesEstadoDialog } from "./EmbarquesEstadoDialog";
import { nombreDesdeEmail } from "@/lib/formatters";

const TOP_CLIENTES = 5;

export const OperadorCard = memo(function OperadorCard({ operador }: { operador: OperadorData }) {
  const totalDesglose = useMemo(
    () => ESTADOS_KEYS.reduce((s, k) => s + operador.desgloseEstados[k], 0),
    [operador]
  );

  const [estadoAbierto, setEstadoAbierto] = useState<EstadoUiKey | null>(null);

  // clientesDesglose ya viene ordenado por cantidad desc desde useOperacionesData
  const clientesTop = operador.clientesDesglose.slice(0, TOP_CLIENTES);
  const clientesRestantes = Math.max(operador.clientesDesglose.length - TOP_CLIENTES, 0);

  return (
    <div className="rounded-xl border bg-background p-4 space-y-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{nombreDesdeEmail(operador.nombre)}</p>
            <p className="text-[11px] text-muted-foreground">
              {operador.cargasActivas} embarques activos
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {operador.clientes.length} {operador.clientes.length === 1 ? "cliente" : "clientes"}
        </Badge>
      </div>

      {/* Desglose por estado (clickeable) */}
      <div className="space-y-1.5">
        {ESTADOS_KEYS.map((estado) => {
          const count = operador.desgloseEstados[estado];
          const Icon = ESTADO_ICON[estado];
          const pct = totalDesglose > 0 ? (count / totalDesglose) * 100 : 0;
          const interactive = count > 0;
          return (
            <button
              key={estado}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && setEstadoAbierto(estado)}
              className={`w-full text-left space-y-0.5 rounded-md px-1.5 py-1 -mx-1.5 transition-colors ${
                interactive
                  ? "hover:bg-muted/60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  : "opacity-60 cursor-default"
              }`}
              aria-label={interactive ? `Ver ${count} embarques en ${estado}` : `Sin embarques en ${estado}`}
              title={interactive ? `Ver detalle de ${estado}` : undefined}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="h-3 w-3" style={{ color: ESTADO_COLOR[estado] }} />
                  {estado}
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-semibold tabular-nums">{count}</span>
                  {interactive && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: ESTADO_COLOR[estado],
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Clientes */}
      <div className="pt-2 border-t border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Clientes
        </p>
        {operador.clientesDesglose.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">Sin clientes activos</p>
        ) : (
          <>
            <ul className="space-y-0.5 max-h-56 overflow-y-auto">
              {clientesTop.map((c) => (
                <ClienteExpandible key={c.nombre} cliente={c} />
              ))}
            </ul>
            {clientesRestantes > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1.5 pl-4">
                +{clientesRestantes} {clientesRestantes === 1 ? "cliente más" : "clientes más"}
              </p>
            )}
          </>
        )}
      </div>

      {estadoAbierto && (
        <EmbarquesEstadoDialog
          open={!!estadoAbierto}
          onOpenChange={(o) => !o && setEstadoAbierto(null)}
          operador={operador.nombre}
          estado={estadoAbierto}
          bucket={operador.embarquesPorEstado[estadoAbierto]}
        />
      )}
    </div>
  );
});
