import { ESTADOS_EMBARQUE } from "@/features/embarques/constants/embarqueConstants";

export function getSiguienteEstado(estadoActual: string) {
  const idx = (ESTADOS_EMBARQUE as readonly string[]).indexOf(estadoActual);
  if (idx < 0 || idx >= ESTADOS_EMBARQUE.length - 1) return null;
  return ESTADOS_EMBARQUE[idx + 1];
}

/** Resuelve el motivo de bloqueo del cierre. Función pura, testeable. */
export function resolveCierreGate(
  cierreVisible: boolean,
  rolPuedeCerrar: boolean,
  validacionOk: boolean,
): "rol" | "checklist" | null {
  if (!cierreVisible) return null;
  if (!rolPuedeCerrar) return "rol";
  if (!validacionOk) return "checklist";
  return null;
}

/** Clasifica el siguiente paso al intentar avanzar. Función pura. */
export type BloqueoAvance = "block_docs" | "warn_docs" | "gate_cierre" | "ok";
export function clasificarBloqueoAvance(params: {
  docsBloqueantes: boolean;
  docsFaltantesCount: number;
  siguiente: string;
  bloqueoCierreMotivo: "rol" | "checklist" | null;
}): BloqueoAvance {
  const { docsBloqueantes, docsFaltantesCount, siguiente, bloqueoCierreMotivo } = params;
  if (docsBloqueantes && docsFaltantesCount > 0) return "block_docs";
  if (!docsBloqueantes && docsFaltantesCount > 0) return "warn_docs";
  if (siguiente === "Cerrado" && bloqueoCierreMotivo !== null) return "gate_cierre";
  return "ok";
}
