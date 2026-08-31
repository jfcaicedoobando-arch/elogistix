/**
 * Persistencia del borrador del wizard de cotización (lectura/escritura en
 * localStorage). Extraído de `useCotizacionDraftAutosave.ts` (v13.342.0) para
 * respetar el límite de 200 líneas por archivo: aquí vive el formato del draft
 * y su validación; el hook sólo orquesta el debounce.
 */
import { getStorageRef, safeLocalStorage } from "@/lib/browserStorage";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
/** VF-17: tolerancia de sesgo de reloj; un savedAt más allá es inválido. */
const CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 min
export const DEBOUNCE_MS = 800;

/**
 * EC-6: la clave incluye la organización activa. Un super admin o un usuario
 * con varias membresías cambiaba de tenant y el wizard le ofrecía restaurar el
 * borrador capturado en la organización anterior (fuga cross-tenant).
 */
export const DRAFT_KEY_PREFIX = "lc:cotizacion:draft:";
export const draftKey = (userId: string, organizationId?: string | null): string =>
  `${DRAFT_KEY_PREFIX}${organizationId || "sin-org"}:${userId || "anon"}`;

export interface StoredDraft {
  version: 3;
  savedAt: number;
  /** B-003 (v13.320.32): sin esto, recargar el wizard tras paso 1 duplicaba
   *  la cotización — el `cotizacionId` vivía sólo en memoria React. */
  cotizacionId: string | null;
  values: CotizacionFormValues;
  /** Q-12: paso del wizard en el que estaba el usuario al autoguardar. */
  currentStep: number;
  /** Q-12: filas de costos internos (P&L) capturadas en el paso 2. */
  costosInternos: FilaCostoLocal[];
  /** Etiquetas de lo que NO se pudo restaurar (drafts legacy sin estos campos,
   *  o el archivo MSDS que nunca se persiste por no ser serializable). */
  noRestaurado: string[];
  /** M-12 (v14-2): identificador de la pestaña que escribió el borrador.
   *  Sirve para detectar que OTRA pestaña sobrescribió el draft (evento
   *  `storage`) y avisar en vez de perder captura en silencio. Ausente en
   *  drafts legacy (se tratan como de otra pestaña desconocida). */
  tabId?: string;
}

/** Campos `Date` del form que se pierden al pasar por JSON.stringify. */
const DATE_FIELDS: readonly (keyof CotizacionFormValues)[] = ["validezPropuesta"];

function reviveDateFields(values: CotizacionFormValues): void {
  // SAFE-CAST: rehidratación local de fechas serializadas a JSON en el draft (ver mem://principles/safe-cast).
  const bag = values as unknown as Record<string, unknown>;
  for (const key of DATE_FIELDS) {
    const raw = bag[key as string];
    if (typeof raw === "string") {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) bag[key as string] = d;
    }
  }
}

interface RawDraftShape {
  savedAt?: unknown;
  version?: unknown;
  values?: CotizacionFormValues;
  cotizacionId?: unknown;
  currentStep?: unknown;
  costosInternos?: unknown;
  tabId?: unknown;
}

/** El archivo MSDS nunca sobrevive a `JSON.stringify`; siempre se avisa. */
const AVISO_MSDS = "El archivo MSDS adjunto (si lo había) — vuelve a adjuntarlo";

/** Valida shape mínimo y versión soportada del JSON crudo del draft. */
function leerBag(raw: string): RawDraftShape | null {
  const parsedUnknown: unknown = JSON.parse(raw);
  if (!parsedUnknown || typeof parsedUnknown !== "object") return null;
  const bag = parsedUnknown as RawDraftShape;
  if (typeof bag.savedAt !== "number") return null;
  // Aceptamos v1/v2 (legacy, sin paso/costos) y v3 (completo).
  if (bag.version !== 1 && bag.version !== 2 && bag.version !== 3) return null;
  return bag;
}

/**
 * VF-17: frescura del borrador — inválido si expiró (>24 h) o si su timestamp
 * está en el futuro más allá del sesgo de reloj (TZ/reloj desajustado generaba
 * prompts fantasma de "guardado hace 2 min" en una sesión nueva).
 */
function esFresco(savedAt: number): boolean {
  const ahora = Date.now();
  return ahora - savedAt <= DRAFT_TTL_MS && savedAt <= ahora + CLOCK_SKEW_MS;
}

function avisosNoRestaurado(version: unknown): string[] {
  const noRestaurado: string[] = [AVISO_MSDS];
  if (version !== 3) {
    noRestaurado.push("El paso del asistente en el que ibas — se reinicia en el Paso 1");
    noRestaurado.push("Los costos internos capturados — tendrás que volver a agregarlos");
  }
  return noRestaurado;
}

export function loadDraft(userId: string, organizationId?: string | null): StoredDraft | null {
  const raw = safeLocalStorage.getItem(draftKey(userId, organizationId));
  if (!raw) return null;
  try {
    const bag = leerBag(raw);
    if (!bag) return null;
    const savedAtNum = bag.savedAt as number;
    if (!esFresco(savedAtNum)) {
      safeLocalStorage.removeItem(draftKey(userId, organizationId));
      return null;
    }

    // SAFE-CAST: shape mínimo validado + rehidratación de fechas.
    const parsed: StoredDraft = {
      version: 3,
      savedAt: savedAtNum,
      cotizacionId: typeof bag.cotizacionId === "string" ? bag.cotizacionId : null,
      values: bag.values as CotizacionFormValues,
      currentStep: typeof bag.currentStep === "number" && bag.currentStep >= 1 ? bag.currentStep : 1,
      costosInternos: Array.isArray(bag.costosInternos) ? (bag.costosInternos as FilaCostoLocal[]) : [],
      noRestaurado: avisosNoRestaurado(bag.version),
      tabId: typeof bag.tabId === "string" ? bag.tabId : undefined,
    };
    reviveDateFields(parsed.values);
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string, organizationId?: string | null): void {
  safeLocalStorage.removeItem(draftKey(userId, organizationId));
}

/**
 * Barre TODOS los borradores del wizard de cotización del dispositivo. Se
 * llama al cerrar sesión (frontend_hunter P3): el draft persiste 24 h en
 * claro e incluye precios, costos internos y márgenes (P&L) del tenant —
 * no debe sobrevivir al logout en un equipo compartido.
 */
export function clearAllDrafts(): void {
  const storage = getStorageRef("local");
  if (!storage) return;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(DRAFT_KEY_PREFIX)) keys.push(key);
  }
  for (const key of keys) safeLocalStorage.removeItem(key);
}
