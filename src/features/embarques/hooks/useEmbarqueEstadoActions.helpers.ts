import { ESTADOS_EMBARQUE } from "@/features/embarques/constants/embarqueConstants";

/**
 * Estados laterales del grafo que no forman parte del happy path lineal en
 * `ESTADOS_EMBARQUE` pero que sí deben poder avanzar por UI. Mapean al
 * siguiente estado válido según `transicion_embarque_valida` (mig.
 * `20260718214722`). Sin esto, `getSiguienteEstado` retorna null y el botón
 * "Avanzar estado" desaparece dejando al operador atorado. v13.302.11.
 */
const SIGUIENTE_LATERAL: Record<string, string> = {
  "En Proceso": "En Aduana",
};

export function getSiguienteEstado(estadoActual: string) {
  if (SIGUIENTE_LATERAL[estadoActual]) return SIGUIENTE_LATERAL[estadoActual];
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
export type BloqueoAvance =
  | "block_docs"
  | "warn_docs"
  | "gate_cierre"
  | "block_fecha_llegada"
  | "ok";
export function clasificarBloqueoAvance(params: {
  docsBloqueantes: boolean;
  docsFaltantesCount: number;
  siguiente: string;
  bloqueoCierreMotivo: "rol" | "checklist" | null;
  fechaLlegadaReal: string | null;
}): BloqueoAvance {
  const { docsBloqueantes, docsFaltantesCount, siguiente, bloqueoCierreMotivo, fechaLlegadaReal } = params;
  if (docsBloqueantes && docsFaltantesCount > 0) return "block_docs";
  if (siguiente === "Arribo" && !fechaLlegadaReal) return "block_fecha_llegada";
  if (!docsBloqueantes && docsFaltantesCount > 0) return "warn_docs";
  if (siguiente === "Cerrado" && bloqueoCierreMotivo !== null) return "gate_cierre";
  return "ok";
}
