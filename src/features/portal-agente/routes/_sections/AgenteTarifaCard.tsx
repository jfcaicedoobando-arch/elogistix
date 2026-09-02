/**
 * Tarjeta móvil de una tarifa del agente (<md). Muestra sin scroll horizontal
 * los campos críticos: ruta, naviera, contenedor, flete base, vigencia,
 * estado/advertencia de vigencia y el menú de acciones.
 * v13.823.29.
 */
import type { AgenteTarifaRow } from "@/features/portal-agente/services";
import { formatNumber } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters";
import {
  AgenteTarifaAcciones,
  EstadoConVigencia,
  type AgenteTarifasColumnsDeps,
} from "./agenteTarifasColumns";

export function AgenteTarifaCard({
  t, onEditar, onDuplicar,
}: { t: AgenteTarifaRow } & AgenteTarifasColumnsDeps) {
  return (
    <div className="flex items-start justify-between gap-2 min-w-0">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-medium text-body break-words">
          {t.puerto_origen_nombre} → {t.puerto_destino_nombre}
        </div>
        <div className="text-label text-muted-foreground break-words">
          {t.naviera_nombre} · {t.tipo_contenedor_nombre}
        </div>
        <div className="text-body-sm tabular-nums">
          {t.moneda} {formatNumber(Number(t.flete_base), { decimals: 2 })}
        </div>
        <div className="text-label text-muted-foreground tabular-nums">
          {formatDate(t.vigente_desde, "dd/MM/yy")} → {formatDate(t.vigente_hasta, "dd/MM/yy")}
        </div>
        <EstadoConVigencia t={t} />
        {t.estado_aprobacion === "rechazada" && t.motivo_rechazo && (
          <p className="text-label text-destructive break-words">
            <strong>Motivo:</strong> {t.motivo_rechazo}
          </p>
        )}
      </div>
      <div className="shrink-0">
        <AgenteTarifaAcciones t={t} onEditar={onEditar} onDuplicar={onDuplicar} />
      </div>
    </div>
  );
}
