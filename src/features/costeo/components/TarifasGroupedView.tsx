/**
 * Vista agrupada por ruta + tipo de contenedor.
 * Marca la mejor tarifa (menor total comparable, aprobada y vigente) por grupo.
 * v13.135.49
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";
import { TarifaEstadoUnificado } from "./TarifaEstadoUnificado";
import { TarifaRowActions } from "./TarifaRowActions";
import { DialogRechazarTarifa } from "./DialogRechazarTarifa";
import { useAprobacionTarifa } from "../hooks/useAprobacionTarifa";
import { usd, formatVigencia, vigenciaHint } from "../routes/CosteoTarifas.helpers";
import type { CosteoTarifaEstado } from "@/features/costeo/types";

interface TarifaRow {
  id: string;
  puerto_origen_nombre: string;
  puerto_destino_nombre: string;
  agente_nombre: string;
  naviera_nombre: string;
  tipo_contenedor_nombre: string;
  agente_id?: string;
  flete_base: number | string;
  recargos_total: number;
  total_comparable: number;
  vigente_desde: string;
  vigente_hasta: string;
  estado: CosteoTarifaEstado;
  estado_aprobacion?: string;
  motivo_rechazo?: string | null;
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
        rows: [],
        mejor: null,
        agentes: 0,
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
  }
  return Array.from(map.values()).sort((a, b) => a.rutaLabel.localeCompare(b.rutaLabel));
}

interface FilaProps {
  t: TarifaRow;
  esMejor: boolean;
  mejorTotal: number | null;
  onEditar: () => void;
  onDuplicar: () => void;
  onEliminar: () => void;
  onAprobar: () => void;
  onRechazar: () => void;
  onReactivar: () => void;
  pending: boolean;
}

function Fila({ t, esMejor, mejorTotal, onEditar, onDuplicar, onEliminar, onAprobar, onRechazar, onReactivar, pending }: FilaProps) {
  const ap = t.estado_aprobacion ?? "vigente";
  const hint = vigenciaHint(t.vigente_hasta);
  const hoy = new Date().toISOString().slice(0, 10);
  const atenuar = !esMejor && (t.vigente_hasta < hoy || t.estado === "vencida" || t.estado === "reemplazada");
  const hintCls = hint.tone === "danger"
    ? "text-destructive"
    : hint.tone === "warn"
      ? "text-warning"
      : esMejor ? "text-success" : "text-muted-foreground";
  const delta = mejorTotal != null && !esMejor && t.total_comparable > mejorTotal
    ? t.total_comparable - mejorTotal : 0;
  return (
    <div
      className={`grid grid-cols-[1fr_140px_160px_150px_auto] gap-4 items-center px-4 py-2.5 text-sm transition-colors hover:bg-muted/30 ${esMejor ? "bg-success/5" : ""} ${atenuar ? "opacity-60" : ""}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {esMejor && (
            <Badge className="bg-success/15 text-success border-success/30 gap-1" variant="outline">
              <Trophy className="size-3" />Mejor
            </Badge>
          )}
          <span className="font-medium truncate">{t.agente_nombre}</span>
        </div>
        <div className="text-xs text-muted-foreground truncate">{t.naviera_nombre}</div>
      </div>
      <div className="text-right tabular-nums text-xs text-muted-foreground">
        <div>Flete {usd(Number(t.flete_base))}</div>
        <div>Recargos {usd(t.recargos_total)}</div>
      </div>
      <div className="text-right tabular-nums">
        <div className={`text-base font-semibold ${esMejor ? "text-success" : ""}`}>
          {usd(t.total_comparable)}
        </div>
        {delta > 0 && (
          <div className="text-[11px] text-muted-foreground">+{usd(delta)} vs mejor</div>
        )}
      </div>
      <div className="text-xs">
        <div>{formatVigencia(t.vigente_desde, t.vigente_hasta)}</div>
        <div className={hintCls}>{hint.text}</div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <TarifaEstadoUnificado estado={t.estado} estadoAprobacion={ap} vigenteHasta={t.vigente_hasta} motivo={t.motivo_rechazo} />
        <TarifaRowActions
          estadoAprobacion={ap}
          onEditar={onEditar}
          onDuplicar={onDuplicar}
          onEliminar={onEliminar}
          onAprobar={onAprobar}
          onRechazar={onRechazar}
          onReactivar={onReactivar}
          disabled={pending}
        />
      </div>
    </div>
  );
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
                </div>
              </div>
              {g.mejor && (
                <Badge className="bg-success/15 text-success border-success/30 tabular-nums" variant="outline">
                  <Trophy className="size-3 mr-1" />Mejor {usd(g.mejor.total_comparable)}
                </Badge>
              )}
            </button>
            {!isCollapsed && (
              <div className="divide-y">
                {g.rows.map((t) => (
                  <Fila
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
