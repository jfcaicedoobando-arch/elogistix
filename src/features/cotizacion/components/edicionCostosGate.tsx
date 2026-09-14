/**
 * Gate de edición de costos del detalle de cotización (v13.823.366, extraído
 * en v13.823.368 por Power of 10): espejo del guard servidor
 * `LC_COT_COSTOS_ESTADO_INVALIDO` (edición sólo en Borrador/Solicitada).
 */
import { usePermissions } from "@/hooks/shared";
import { motivoBloqueoEdicionCostos } from "@/features/cotizacion/domain/estadosEditables";
import type { EstadoCotizacion } from "@/features/cotizacion/services/mutations/estado";

export function useGateEdicionCostos(estadoCotizacion: EstadoCotizacion) {
  // v13.823.348 — `actualizar_cotizacion_costos` exige `_assert_writer_cotizacion`
  // (SALES): finanzas ve el P&L en solo lectura, sin "Editar/Guardar costos".
  const { canWriteCotizaciones } = usePermissions();
  const motivo = canWriteCotizaciones
    ? motivoBloqueoEdicionCostos(estadoCotizacion)
    : null;
  return {
    canWriteCotizaciones,
    canEdit: canWriteCotizaciones && motivo === null,
    motivoBloqueoEstado: motivo,
  };
}

/** Aviso breve cuando el estado de la cotización ya no permite editar costos. */
export function AvisoCostosBloqueados({
  motivo,
  visible,
}: {
  motivo: string | null;
  visible: boolean;
}) {
  if (!motivo || !visible) return null;
  return <p className="text-body-sm text-muted-foreground">{motivo}</p>;
}
