/**
 * Vista agrupada por ruta + tipo de contenedor.
 * v13.135.53: header de columnas alineado, mini-barra de vigencia,
 * micro-meta "por vencer" en header del grupo.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";
import { TarifaFila, TarifaColumnHeader, type FilaTarifa } from "./TarifaFila";
import { DialogRechazarTarifa } from "./DialogRechazarTarifa";
import { useAprobacionTarifa } from "../hooks/useAprobacionTarifa";
import { usd, vigenciaHint } from "../routes/CosteoTarifas.helpers";

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

interface Grupo {
  key: string;
  rutaLabel: string;
  contenedor: string;
  rows: TarifaRow[];
  mejor: TarifaRow | null;
  agentes: number;
  porVencer: number;
  promedio: number | null;
  deltaMax: number | null;
  elegiblesCount: number;
}

function buildGrupos(tarifas: TarifaRow[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const t of tarifas) {
    const key = `${t.puerto_origen_nombre}→${t.puerto_destino_nombre}|${t.tipo_contenedor_nombre}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        rutaLabel: `${t.puerto_origen_nombre} → ${t.puerto_destino_nombre}`,
        contenedor: t.tipo_contenedor_nombre,
        rows: [], mejor: null, agentes: 0, porVencer: 0,
        promedio: null, deltaMax: null, elegiblesCount: 0,
      };
      map.set(key, g);
    }
    g.rows.push(t);
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const g of map.values()) {
    g.rows.sort((a, b) => a.total_comparable - b.total_comparable);
    const elegibles = g.rows.filter(
      (r) => (r.estado_aprobacion ?? "vigente") === "vigente" && r.vigente_hasta >= today && r.estado !== "reemplazada",
    );
    g.mejor = elegibles[0] ?? null;
    g.agentes = new Set(g.rows.map((r) => r.agente_nombre)).size;
    g.porVencer = elegibles.filter((r) => vigenciaHint(r.vigente_hasta).tone === "warn").length;
    g.elegiblesCount = elegibles.length;
    if (elegibles.length >= 2) {
      const suma = elegibles.reduce((acc, r) => acc + r.total_comparable, 0);
      g.promedio = suma / elegibles.length;
      const peor = elegibles[elegibles.length - 1].total_comparable;
      g.deltaMax = peor - elegibles[0].total_comparable;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.rutaLabel.localeCompare(b.rutaLabel));
}

export function TarifasGroupedView({ tarifas, onEditar, onDuplicar, onEliminar }: Props) {
  const grupos = useMemo(() => buildGrupos(tarifas), [tarifas]);
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
      {grupos.map((g) => {
        const isCollapsed = collapsed.has(g.key);
        return (
          <Card key={g.key} className="overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(g.key)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
              {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{g.rutaLabel}</div>
                <div className="text-xs text-muted-foreground">
                  {g.contenedor} · {g.rows.length} tarifa{g.rows.length === 1 ? "" : "s"} · {g.agentes} agente{g.agentes === 1 ? "" : "s"}
                  {g.porVencer > 0 && (
                    <span className="text-warning"> · {g.porVencer} por vencer</span>
                  )}
                </div>
              </div>
              {g.mejor && (
                <Badge className="bg-success/15 text-success border-success/30 tabular-nums" variant="outline">
                  <Trophy className="size-3 mr-1" />Mejor {usd(g.mejor.total_comparable)}
                </Badge>
              )}
            </button>
            {!isCollapsed && (
              <div>
                <TarifaColumnHeader />
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
                      onAprobar={() => aprobar.mutate(t.id)}
                      onRechazar={() => setRechazandoId(t.id)}
                      onReactivar={() => reactivar.mutate(t.id)}
                      pending={pending}
                    />
                  ))}
                </div>
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
