import type { SubmitOrchestratorParams } from "./useEmbarqueSubmitOrchestrator";

export function expedienteBorrador(p: SubmitOrchestratorParams): string {
  if (p.modoExpediente !== "existente") return "";
  const expediente = p.expedienteSeleccionado?.expediente;
  if (!expediente) throw new Error("Expediente requerido");
  return expediente;
}

export function payloadBorrador(p: SubmitOrchestratorParams, expediente: string, email?: string) {
  return {
    ...p.buildEmbarquePayload(p.contactos, p.selectedClienteNombre, email ?? ""),
    expediente: expediente || null,
    estado: "Borrador" as const,
    ...(p.cotizacionVinculada ? { cotizacion_id: p.cotizacionVinculada.id } : {}),
  };
}
