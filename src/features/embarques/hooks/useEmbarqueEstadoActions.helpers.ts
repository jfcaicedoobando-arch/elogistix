import { ESTADOS_EMBARQUE } from "@/features/embarques/constants/embarqueConstants";

/**
 * Estados laterales del grafo que no forman parte del happy path lineal en
 * `ESTADOS_EMBARQUE` pero que sí deben poder avanzar por UI. Mapean al
 * siguiente estado válido según `transicion_embarque_valida` (mig.
 * `20260718214722`). Sin esto, `getSiguienteEstado` retorna null y el botón
 * "Avanzar estado" desaparece dejando al operador atorado. v13.302.11.
 */
const SIGUIENTE_LATERAL: Record<string, string> = {
  // v13.303.22 — `En Proceso` desemboca ahora en Arribo (nuevo orden).
  "En Proceso": "Arribo",
  // v13.303.21 — `Cotización` (Propuesta) fue eliminado del happy path.
  // Si un embarque legacy sigue en este estado, ofrecer avanzar a Confirmado
  // para desatorarlo. La transición está permitida en la máquina de estados BD.
  "Cotización": "Confirmado",
  // v13.303.22 — `Llegada` deprecado; rescate hacia Arribo.
  "Llegada": "Arribo",
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

/**
 * Clasifica el mensaje de error devuelto por `avanzar_estado_embarque` en
 * una acción UX. Puro para poder testearse aisladamente.
 */
export type AvanceErrorKind = "block_docs" | "block_fecha_llegada" | "transicion_invalida" | "generic";
export function clasificarAvanceError(msg: string): AvanceErrorKind {
  if (msg.includes("documentos_faltantes")) return "block_docs";
  if (msg.includes("fecha_llegada_real_requerida")) return "block_fecha_llegada";
  if (msg.includes("LC_TRANSICION_INVALIDA")) return "transicion_invalida";
  return "generic";
}

/**
 * B-027: mínimos operativos para pasar de Borrador a Confirmado.
 * Devuelve la lista de faltantes en lenguaje de negocio (vacía = puede avanzar).
 * Función pura, testeable.
 */
export function faltantesParaConfirmado(
  embarque: {
    modo?: string | null;
    tipo_servicio?: string | null;
    peso_kg?: number | null;
    naviera?: string | null;
    bl_master?: string | null;
    bl_house?: string | null;
    aerolinea?: string | null;
    mawb?: string | null;
    transportista?: string | null;
  },
  numContenedores: number,
): string[] {
  const faltantes: string[] = [];
  if (!embarque.peso_kg || embarque.peso_kg <= 0) faltantes.push("peso mayor a 0 kg");
  faltantes.push(...faltantesMaritimo(embarque, numContenedores));
  faltantes.push(...faltantesAereo(embarque));
  if (embarque.modo === "Terrestre" && !embarque.transportista?.trim()) {
    faltantes.push("transportista");
  }
  return faltantes;
}

function faltantesMaritimo(
  embarque: { modo?: string | null; tipo_servicio?: string | null; naviera?: string | null; bl_master?: string | null; bl_house?: string | null },
  numContenedores: number,
): string[] {
  if (embarque.modo !== "Marítimo") return [];
  const out: string[] = [];
  // LCL no exige contenedores dinámicos (el número es opcional).
  if (embarque.tipo_servicio !== "LCL" && numContenedores === 0) {
    out.push("al menos un contenedor");
  }
  if (!embarque.naviera?.trim()) out.push("naviera");
  if (!embarque.bl_master?.trim() && !embarque.bl_house?.trim()) {
    out.push("BL master u house");
  }
  return out;
}

function faltantesAereo(embarque: { modo?: string | null; aerolinea?: string | null; mawb?: string | null }): string[] {
  if (embarque.modo !== "Aéreo") return [];
  const out: string[] = [];
  if (!embarque.aerolinea?.trim()) out.push("aerolínea");
  if (!embarque.mawb?.trim()) out.push("MAWB");
  return out;
}

