/**
 * Vista agrupada por ruta + tipo de contenedor.
 * v13.135.53: header de columnas alineado, mini-barra de vigencia,
 * micro-meta "por vencer" en header del grupo.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/shared/Hint";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";
import { TarifaFila, TarifaColumnHeader, type FilaTarifa } from "./TarifaFila";
import { DialogRechazarTarifa } from "./DialogRechazarTarifa";
import { useAprobacionTarifa } from "../hooks/useAprobacionTarifa";
import { usd } from "../routes/CosteoTarifas.helpers";
import { buildGruposTarifas } from "../utils/tarifasAgrupacion";
import { todayLocalISO } from "@/lib/date/today";

interface TarifaRow extends FilaTarifa {
  puerto_origen_nombre: string;
  puerto_destino_nombre: string;
  tipo_contenedor_nombre: string;
  agente_id?: string;
}

interface Props {
  tarifas: TarifaRow[];
  onEditar: (id: string) => void;
  onDuplicar: (id: string) => void;
  onEliminar: (id: string) => void;
}

export function TarifasGroupedView({ tarifas, onEditar, onDuplicar, onEliminar }: Props) {
  const grupos = useMemo(() => buildGruposTarifas(tarifas, todayLocalISO()), [tarifas]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { aprobar, rechazar, reactivar } = useAprobacionTarifa();
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);
  const pending = aprobar.isPending || reactivar.isPending;

  const toggle = (k: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 bg-background rounded-md border overflow-hidden">
        <TarifaColumnHeader />
      </div>
      {grupos.map((g) => {
        const isCollapsed = collapsed.has(g.key);
        return (
          <Card key={g.key} className="overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(g.key)}
              className="w-full flex items-center gap-3 px-4 py-2 bg-muted/15 hover:bg-muted/30 transition-colors text-left"
            >
              {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{g.rutaLabel}</div>
                <div className="text-body-sm text-muted-foreground">
                  {g.contenedor} · {g.rows.length} tarifa{g.rows.length === 1 ? "" : "s"} · {g.agentes} agente{g.agentes === 1 ? "" : "s"}
                  {g.porVencer > 0 && (
                    <span className="text-warning"> · {g.porVencer} por vencer</span>
                  )}
                </div>
              </div>
              {g.elegiblesCount >= 2 && g.promedio != null && g.deltaMax != null && (
                <div className="hidden md:block text-right text-label text-muted-foreground tabular-nums leading-tight mr-1">
                  <div>Promedio {usd(g.promedio)}</div>
                  <div>Δ máx {usd(g.deltaMax)}</div>
                </div>
              )}
              {g.mejor && (
                <Hint label="Menor total comparable (flete base + recargos incluidos en total) entre tarifas aprobadas, vigentes y no reemplazadas">
                  <Badge
                    className="bg-success/15 text-success border-success/30 tabular-nums min-w-[150px] justify-end"
                    variant="outline"
                  >
                    <Trophy className="size-3 mr-1" />Mejor {usd(g.mejor.total_comparable)}
                  </Badge>
                </Hint>
              )}
            </button>
            {!isCollapsed && (
              <div className="divide-y divide-border/60">
                {g.rows.map((t) => (
                  <TarifaFila
                    key={t.id}
                    t={t}
                    esMejor={g.mejor?.id === t.id}
                    mejorTotal={g.mejor?.total_comparable ?? null}
                    onEditar={() => onEditar(t.id)}
                    onDuplicar={() => onDuplicar(t.id)}
                    onEliminar={() => onEliminar(t.id)}
                    onAprobar={() => aprobar.mutate({ id: t.id, vigenteHasta: t.vigente_hasta })}
                    onRechazar={() => setRechazandoId(t.id)}
                    onReactivar={() => reactivar.mutate(t.id)}
                    pending={pending}
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {grupos.length > 1 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((prev) => (prev.size === grupos.length ? new Set() : new Set(grupos.map((g) => g.key))))}
          >
            {collapsed.size === grupos.length ? "Expandir todos" : "Colapsar todos"}
          </Button>
        </div>
      )}

      <DialogRechazarTarifa
        open={!!rechazandoId}
        onOpenChange={(o) => !o && setRechazandoId(null)}
        pending={rechazar.isPending}
        onConfirm={(motivo) => {
          if (!rechazandoId) return;
          rechazar.mutate(
            { id: rechazandoId, motivo },
            { onSuccess: () => setRechazandoId(null) },
          );
        }}
      />
    </div>
  );
}
