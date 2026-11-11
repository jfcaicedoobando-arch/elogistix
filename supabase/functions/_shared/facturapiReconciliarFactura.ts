export interface FapiInvoiceStatus {
  status?: string;
  cancellation_status?: string;
}

export interface ResolvedPatch {
  outcome: "accepted" | "rejected" | "expired" | "transition" | "no_change";
  patch: Record<string, unknown>;
}

/** Calcula la transición de cancelación para la consulta manual y el cron. */
export function resolveNextAction(
  remote: FapiInvoiceStatus,
  local: { cancellation_status: string; sustituida_por: string | null },
  nowIso: string,
): ResolvedPatch {
  const estadoCancelacion = (remote.cancellation_status ?? "").toLowerCase();

  // La aceptación tiene prioridad para reparar una factura cuyo estado local
  // quedó desfasado aunque el estado de cancelación ya coincida.
  if (estadoCancelacion === "accepted" || remote.status === "canceled") {
    return {
      outcome: "accepted",
      patch: {
        estado: local.sustituida_por ? "Sustituida" : "Cancelada",
        cancellation_status: "accepted",
        cancelado_en: nowIso,
      },
    };
  }

  // Una respuesta remota vacía conserva el estado local pendiente.
  if (!estadoCancelacion || estadoCancelacion === local.cancellation_status) {
    return { outcome: "no_change", patch: {} };
  }

  if (estadoCancelacion === "rejected" || estadoCancelacion === "expired") {
    return {
      outcome: estadoCancelacion,
      patch: {
        cancellation_status: estadoCancelacion,
        cancelacion_solicitada_en: null,
        cancelacion_vence_en: null,
      },
    };
  }

  return {
    outcome: "transition",
    patch: { cancellation_status: estadoCancelacion },
  };
}
