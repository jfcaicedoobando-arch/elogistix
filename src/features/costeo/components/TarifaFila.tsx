/**
 * Fila de tarifa dentro de un grupo. Extraída para mantener
 * TarifasGroupedView ≤200 líneas (Power of 10).
 * v13.135.53
 */
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { TarifaEstadoUnificado } from "./TarifaEstadoUnificado";
import { TarifaRowActions } from "./TarifaRowActions";
import { VigenciaBar } from "./VigenciaBar";
import { usd } from "../routes/CosteoTarifas.helpers";
import type { CosteoTarifaEstado } from "@/features/costeo/types";

export interface FilaTarifa {
  id: string;
  agente_nombre: string;
  naviera_nombre: string;
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
  t: FilaTarifa;
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

export const FILA_GRID = "grid grid-cols-[1fr_140px_160px_150px_auto] gap-4 items-center px-4";

export function TarifaFila({
  t, esMejor, mejorTotal,
  onEditar, onDuplicar, onEliminar, onAprobar, onRechazar, onReactivar, pending,
}: Props) {
  const ap = t.estado_aprobacion ?? "vigente";
  const hoy = new Date().toISOString().slice(0, 10);
  const atenuar = !esMejor && (t.vigente_hasta < hoy || t.estado === "vencida" || t.estado === "reemplazada");
  const delta = mejorTotal != null && !esMejor && t.total_comparable > mejorTotal
    ? t.total_comparable - mejorTotal : 0;
  return (
    <div
      className={`${FILA_GRID} py-2.5 text-sm transition-colors hover:bg-muted/40 ${esMejor ? "bg-success/5" : ""} ${atenuar ? "opacity-60" : ""}`}
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
      <VigenciaBar desde={t.vigente_desde} hasta={t.vigente_hasta} />
      <div className="flex justify-end">
        <TarifaEstadoUnificado estado={t.estado} estadoAprobacion={ap} vigenteHasta={t.vigente_hasta} motivo={t.motivo_rechazo} />
      </div>
      <div className="text-right tabular-nums">
        <div className={`text-base font-semibold ${esMejor ? "text-success" : ""}`}>
          {usd(t.total_comparable)}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Flete {usd(Number(t.flete_base))} · Recargos {usd(t.recargos_total)}
        </div>
        {delta > 0 && (
          <div className="text-[11px] text-muted-foreground">+{usd(delta)} vs mejor</div>
        )}
      </div>
      <div className="flex items-center justify-end">
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

export function TarifaColumnHeader() {
  return (
    <div className={`${FILA_GRID} py-2 text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/10 border-b`}>
      <div>Agente · Naviera</div>
      <div>Vigencia</div>
      <div className="text-right">Estado</div>
      <div className="text-right">Total USD</div>
      <div className="text-right">Acciones</div>
    </div>
  );
}
