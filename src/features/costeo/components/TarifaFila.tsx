/**
 * Fila de tarifa dentro de un grupo.
 * v13.142.4: botones Aprobar/Rechazar siempre visibles en "borrador" (antes ocultos en hover y cortados).
 */
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trophy } from "lucide-react";
import { TarifaEstadoUnificado } from "./TarifaEstadoUnificado";
import { TarifaRowActions } from "./TarifaRowActions";
import { TarifaQuickApprovalButtons } from "./TarifaQuickApprovalButtons";
import { VigenciaBar } from "./VigenciaBar";
import { usd } from "../routes/CosteoTarifas.helpers";
import type { CosteoTarifaEstado } from "@/features/costeo/types";
import { todayLocalISO } from "@/lib/date/today";

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
  created_at?: string;
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

export const FILA_GRID = "grid grid-cols-[minmax(200px,1.3fr)_140px_120px_minmax(180px,1fr)_minmax(180px,auto)] gap-4 items-center px-4";

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function esReciente(createdAt?: string): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < SIETE_DIAS_MS;
}

/**
 * Lint (complejidad): la fila mezclaba render y ~6 derivaciones booleanas.
 * Se extraen a un helper puro para mantener el componente por debajo del
 * límite de complejidad sin cambiar comportamiento.
 */
function derivarEstadoFila(
  t: Props["t"],
  esMejor: boolean,
  mejorTotal: number | null | undefined,
) {
  const ap = t.estado_aprobacion ?? "vigente";
  const hoy = todayLocalISO();
  const esVencida = t.estado === "vencida";
  const atenuar = !esMejor && (t.vigente_hasta < hoy || esVencida || t.estado === "reemplazada");
  const delta = !esVencida && mejorTotal != null && !esMejor && t.total_comparable > mejorTotal
    ? t.total_comparable - mejorTotal : 0;
  return {
    ap,
    atenuar,
    delta,
    nueva: !esVencida && esReciente(t.created_at),
    puedeAprobar: ap === "borrador",
  };
}

export function TarifaFila({
  t, esMejor, mejorTotal,
  onEditar, onDuplicar, onEliminar, onAprobar, onRechazar, onReactivar, pending,
}: Props) {
  const { ap, atenuar, delta, nueva, puedeAprobar } = derivarEstadoFila(t, esMejor, mejorTotal);

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
          {nueva && (
            <Badge className="bg-primary/10 text-primary border-primary/30 gap-1" variant="outline" title="Capturada en los últimos 7 días">
              <Sparkles className="size-3" />Nueva
            </Badge>
          )}
          <span className="font-medium truncate">{t.agente_nombre}</span>
        </div>
        <div className="text-xs text-muted-foreground truncate">{t.naviera_nombre}</div>
      </div>
      <VigenciaBar desde={t.vigente_desde} hasta={t.vigente_hasta} />
      <div className="flex justify-start">
        <TarifaEstadoUnificado estado={t.estado} estadoAprobacion={ap} vigenteHasta={t.vigente_hasta} motivo={t.motivo_rechazo} />
      </div>
      <div className="text-right tabular-nums">
        <div className={`text-base font-semibold ${esMejor ? "text-success" : ""}`}>
          {usd(t.total_comparable)}
        </div>
        <div className="text-label text-muted-foreground">
          Flete {usd(Number(t.flete_base))} · Recargos {usd(t.recargos_total)}
        </div>
        {delta > 0 && (
          <div className="text-label text-muted-foreground">+{usd(delta)} vs mejor</div>
        )}
      </div>
      <div className="flex items-center justify-end gap-1.5">
        {puedeAprobar && (
          <TarifaQuickApprovalButtons
            variant="grouped"
            onAprobar={onAprobar}
            onRechazar={onRechazar}
            disabled={pending}
          />
        )}
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
    <div className={`${FILA_GRID} py-2 text-label uppercase tracking-wide text-muted-foreground bg-muted/20 border-y`}>
      <div>Agente · Naviera</div>
      <div>Vigencia</div>
      <div className="text-left">Estado</div>
      <div className="text-right">Total USD</div>
      <div className="text-right">Acciones</div>
    </div>
  );
}
