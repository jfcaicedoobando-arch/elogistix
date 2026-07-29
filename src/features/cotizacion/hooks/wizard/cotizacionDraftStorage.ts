/**
 * Persistencia del borrador del wizard de cotización (lectura/escritura en
 * localStorage). Extraído de `useCotizacionDraftAutosave.ts` (v13.342.0) para
 * respetar el límite de 200 líneas por archivo: aquí vive el formato del draft
 * y su validación; el hook sólo orquesta el debounce.
 */
import { safeLocalStorage } from "@/lib/browserStorage";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
export const DEBOUNCE_MS = 800;

export const draftKey = (userId: string): string => `lc:cotizacion:draft:${userId || "anon"}`;

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
}

/** El archivo MSDS nunca sobrevive a `JSON.stringify`; siempre se avisa. */
const AVISO_MSDS = "El archivo MSDS adjunto (si lo había) — vuelve a adjuntarlo";

export function loadDraft(userId: string): StoredDraft | null {
  const raw = safeLocalStorage.getItem(draftKey(userId));
  if (!raw) return null;
  try {
    const parsedUnknown: unknown = JSON.parse(raw);
    if (!parsedUnknown || typeof parsedUnknown !== "object" || typeof (parsedUnknown as RawDraftShape).savedAt !== "number") {
      return null;
    }
    const bag = parsedUnknown as RawDraftShape;
    const versionRaw = bag.version;
    // Aceptamos v1/v2 (legacy, sin paso/costos) y v3 (completo).
    if (versionRaw !== 1 && versionRaw !== 2 && versionRaw !== 3) return null;
    if (Date.now() - (bag.savedAt as number) > DRAFT_TTL_MS) {
      safeLocalStorage.removeItem(draftKey(userId));
      return null;
    }

    const noRestaurado: string[] = [AVISO_MSDS];
    if (versionRaw !== 3) {
      noRestaurado.push("El paso del asistente en el que ibas — se reinicia en el Paso 1");
      noRestaurado.push("Los costos internos capturados — tendrás que volver a agregarlos");
    }

    // SAFE-CAST: shape mínimo validado + rehidratación de fechas.
    const parsed: StoredDraft = {
      version: 3,
      savedAt: bag.savedAt as number,
      cotizacionId: typeof bag.cotizacionId === "string" ? bag.cotizacionId : null,
      values: bag.values as CotizacionFormValues,
      currentStep: typeof bag.currentStep === "number" && bag.currentStep >= 1 ? bag.currentStep : 1,
      costosInternos: Array.isArray(bag.costosInternos) ? (bag.costosInternos as FilaCostoLocal[]) : [],
      noRestaurado,
    };
    reviveDateFields(parsed.values);
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string): void {
  safeLocalStorage.removeItem(draftKey(userId));
}
