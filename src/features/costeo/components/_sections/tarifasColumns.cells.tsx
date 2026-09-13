/**
 * Celdas de `tarifasColumns` — extraídas en v13.823.312 (Power-of-10: el
 * archivo de columnas superaba 200 líneas). Sin cambios de comportamiento:
 * mismo marcado y mismas clases responsivas que antes.
 */
import { TarifaEstadoUnificado } from "../TarifaEstadoUnificado";
import { TarifaRowActions } from "../TarifaRowActions";
import { TarifaQuickApprovalButtons } from "../TarifaQuickApprovalButtons";
import { usd, formatVigencia, vigenciaHint } from "../../routes/CosteoTarifas.helpers";
import { todayLocalISO } from "@/lib/date/today";
import type { TarifaRow, TarifasColumnsDeps } from "./tarifasColumns.types";

/** Total comparable con destaque del mejor precio del grupo. */
export function TotalTarifaCell({
  t,
  mejorPorGrupo,
}: {
  t: TarifaRow;
  mejorPorGrupo: TarifasColumnsDeps["mejorPorGrupo"];
}) {
  const ap = t.estado_aprobacion ?? "vigente";
  const grupoKey = `${t.puerto_origen_nombre}→${t.puerto_destino_nombre}|${t.tipo_contenedor_nombre}`;
  const mejor = mejorPorGrupo.get(grupoKey);
  const esMejor = mejor != null && t.total_comparable === mejor && ap === "vigente";
  const delta =
    mejor != null && !esMejor && t.total_comparable > mejor ? t.total_comparable - mejor : 0;
  return (
    <div>
      <div className={`font-semibold ${esMejor ? "text-success" : ""}`}>
        {usd(t.total_comparable)}
      </div>
      {delta > 0 && <div className="text-label text-muted-foreground">+{usd(delta)} vs mejor</div>}
    </div>
  );
}

/** Rango de vigencia con la advertencia por proximidad de vencimiento. */
export function VigenciaTarifaCell({ t }: { t: TarifaRow }) {
  const hint = vigenciaHint(t.vigente_hasta);
  const hintCls =
    hint.tone === "danger"
      ? "text-destructive"
      : hint.tone === "warn"
        ? "text-warning"
        : "text-muted-foreground";
  return (
    <div>
      <div className="text-foreground">{formatVigencia(t.vigente_desde, t.vigente_hasta)}</div>
      <div className={hintCls}>{hint.text}</div>
    </div>
  );
}

/** Estado unificado (aprobación + vigencia). */
export function EstadoTarifaCell({ t }: { t: TarifaRow }) {
  return (
    <TarifaEstadoUnificado
      estado={t.estado}
      estadoAprobacion={t.estado_aprobacion ?? "vigente"}
      vigenteHasta={t.vigente_hasta}
      motivo={t.motivo_rechazo}
    />
  );
}

/**
 * Acciones de la fila. P2 (auditoría v13.823.143 · bug 6): aprobar una tarifa
 * vencida siempre falla en backend, por eso se oculta la acción.
 */
export function AccionesTarifaCell({ t, deps }: { t: TarifaRow; deps: TarifasColumnsDeps }) {
  const {
    aprobarPending, reactivarPending,
    onEditar, onDuplicar, onEliminar, onAprobar, onRechazar, onReactivar,
  } = deps;
  const ap = t.estado_aprobacion ?? "vigente";
  const vencida = t.estado === "vencida" || (t.vigente_hasta ?? "") < todayLocalISO();
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {ap === "borrador" && !vencida && (
        <TarifaQuickApprovalButtons
          variant="table"
          onAprobar={() => onAprobar(t.id)}
          onRechazar={() => onRechazar(t.id)}
          disabled={aprobarPending || reactivarPending}
        />
      )}
      <TarifaRowActions
        estadoAprobacion={ap}
        vencida={vencida}
        onEditar={() => onEditar(t.id)}
        onDuplicar={() => onDuplicar(t.id)}
        onEliminar={() => onEliminar(t.id)}
        onAprobar={() => onAprobar(t.id)}
        onRechazar={() => onRechazar(t.id)}
        onReactivar={() => onReactivar(t.id)}
        disabled={aprobarPending || reactivarPending}
      />
    </div>
  );
}
