/**
 * v13.142.3 — Panel desplegable con el desglose de las alertas que alimentan
 * el badge "Embarques · N" del sidebar. Cada tarjeta aplica un filtro
 * `?alerta=` al listado para que el usuario pueda atender los pendientes
 * sin adivinar qué embarques están detrás del conteo.
 *
 * v13.545.0 — Se separaron "Cierre operativo" (Entregado / EIR) y "Cierre
 * administrativo" (Por liquidar). Las definiciones de tarjeta viven en
 * `constants/alertasTiles.ts`.
 */
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EmbarqueAlertaFiltro } from "@/features/embarques/hooks/useEmbarquesFilters";
import type { EmbarquesAlertasResumen } from "@/features/embarques/services/alertas";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { ALERTAS_TILES } from "@/features/embarques/constants/alertasTiles";

interface Props {
  resumen: EmbarquesAlertasResumen;
  activeAlerta: EmbarqueAlertaFiltro;
  onSelect: (alerta: EmbarqueAlertaFiltro) => void;
}

export function EmbarquesAlertasPanel({ resumen, activeAlerta, onSelect }: Props) {
  if (resumen.total === 0) return null;

  return (
    <Card className="p-4 border-warning/70 bg-warning/40 dark:bg-warning/10">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
          <SectionHeading>Alertas activas</SectionHeading>
          <Badge variant="secondary" className="text-2xs">
            {resumen.total}
          </Badge>
        </div>
        {activeAlerta !== "todos" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onSelect("todos")}
          >
            Ver todas
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {ALERTAS_TILES.map(({ key, titulo, descripcion, Icon, color }) => {

          const count = resumen[key].size;
          const active = activeAlerta === key;
          // v13.223.0 · Capa 3 Tranche A · 2.2: ocultar tiles con count = 0
          // salvo cuando el usuario los eligió activamente (para no dejar la
          // vista vacía si limpian el filtro).
          if (count === 0 && !active) return null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(active ? "todos" : key)}
              aria-pressed={active}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active ? "border-primary ring-2 ring-primary/20 bg-background" : "border-border bg-background/50"
              }`}
            >
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${color}`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{titulo}</span>
                  <span className="text-base font-semibold tabular-nums">{count}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{descripcion}</p>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
