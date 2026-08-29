/**
 * Persistencia del borrador del wizard "Nuevo embarque" (M-13, auditoría
 * v14-2). Réplica del patrón de cotizaciones (`cotizacionDraftStorage.ts`):
 * draft en localStorage con TTL 24 h, clave por usuario+organización y
 * `tabId` para detectar captura simultánea en dos pestañas.
 *
 * Los archivos adjuntos (MSDS / documentos paso 3) NO se persisten — no son
 * serializables; al restaurar se avisa que deben re-adjuntarse.
 */
import { getStorageRef, safeLocalStorage } from "@/lib/browserStorage";
import type { EmbarqueFormValues } from "@/features/embarques/domain/mappers/embarque";
import type { ConceptoVentaLocal, ConceptoCostoLocal } from "@/types/concepto";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
/** Tolerancia de sesgo de reloj; un savedAt en el futuro más allá es inválido. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;
export const EMBARQUE_DRAFT_DEBOUNCE_MS = 800;

export const EMBARQUE_DRAFT_KEY_PREFIX = "lc:embarque:draft:";
export const embarqueDraftKey = (userId: string, organizationId?: string | null): string =>
  `${EMBARQUE_DRAFT_KEY_PREFIX}${organizationId || "sin-org"}:${userId || "anon"}`;

export interface StoredEmbarqueDraft {
  version: 1;
  savedAt: number;
  values: EmbarqueFormValues;
  currentStep: number;
  conceptosVenta: ConceptoVentaLocal[];
  conceptosCosto: ConceptoCostoLocal[];
  /** Cotización a la que estaba vinculado el borrador; sólo se ofrece
   *  restaurar si coincide con la cotización de entrada (o si no hay). */
  cotizacionVinculadaId: string | null;
  /** Identificador de la pestaña que escribió (detección de conflicto). */
  tabId?: string;
}

interface RawDraftShape {
  savedAt?: unknown;
  version?: unknown;
  values?: EmbarqueFormValues;
  currentStep?: unknown;
  conceptosVenta?: unknown;
  conceptosCosto?: unknown;
  cotizacionVinculadaId?: unknown;
  tabId?: unknown;
}

/** Aviso fijo: los adjuntos nunca sobreviven al borrador. */
const AVISO_ADJUNTOS = "Los archivos adjuntos (MSDS y documentos) — vuelve a subirlos";

export function loadEmbarqueDraft(userId: string, organizationId?: string | null): StoredEmbarqueDraft | null {
  const raw = safeLocalStorage.getItem(embarqueDraftKey(userId, organizationId));
  if (!raw) return null;
  try {
    const parsedUnknown: unknown = JSON.parse(raw);
    if (!parsedUnknown || typeof parsedUnknown !== "object" || typeof (parsedUnknown as RawDraftShape).savedAt !== "number") {
      return null;
    }
    const bag = parsedUnknown as RawDraftShape;
    if (bag.version !== 1 || !bag.values) return null;
    const savedAtNum = bag.savedAt as number;
    const ahora = Date.now();
    if (ahora - savedAtNum > DRAFT_TTL_MS || savedAtNum > ahora + CLOCK_SKEW_MS) {
      safeLocalStorage.removeItem(embarqueDraftKey(userId, organizationId));
      return null;
    }
    return {
      version: 1,
      savedAt: savedAtNum,
      values: bag.values,
      currentStep: typeof bag.currentStep === "number" && bag.currentStep >= 1 ? bag.currentStep : 1,
      conceptosVenta: Array.isArray(bag.conceptosVenta) ? (bag.conceptosVenta as ConceptoVentaLocal[]) : [],
      conceptosCosto: Array.isArray(bag.conceptosCosto) ? (bag.conceptosCosto as ConceptoCostoLocal[]) : [],
      cotizacionVinculadaId: typeof bag.cotizacionVinculadaId === "string" ? bag.cotizacionVinculadaId : null,
      tabId: typeof bag.tabId === "string" ? bag.tabId : undefined,
    };
  } catch {
    return null;
  }
}

export function clearEmbarqueDraft(userId: string, organizationId?: string | null): void {
  safeLocalStorage.removeItem(embarqueDraftKey(userId, organizationId));
}

/** Barre todos los borradores de embarque del dispositivo (logout). */
export function clearAllEmbarqueDrafts(): void {
  const storage = getStorageRef("local");
  if (!storage) return;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(EMBARQUE_DRAFT_KEY_PREFIX)) keys.push(key);
  }
  for (const key of keys) safeLocalStorage.removeItem(key);
}

/** Un draft "vacío" (sólo defaults) no merece banner de restauración. */
export function embarqueDraftTieneContenido(values: EmbarqueFormValues, conceptosVenta: ConceptoVentaLocal[], conceptosCosto: ConceptoCostoLocal[]): boolean {
  if (conceptosVenta.some((c) => c.concepto.trim().length > 0 || c.precioUnitario > 0)) return true;
  if (conceptosCosto.some((c) => c.concepto.trim().length > 0 || c.monto > 0)) return true;
  if (values.contenedores.length > 0) return true;
  // Campos con default legítimo que no cuentan como captura.
  const sinSeñal: ReadonlySet<string> = new Set([
    "incoterm", "tipoCarga", "msdsArchivo", "subiendoMsds", "navieraId",
    "agenteId", "cartaGarantia", "diasLibresDestino", "diasAlmacenaje", "seguro",
  ]);
  // SAFE-CAST: sólo se recorren claves para detectar captura real.
  const v = values as unknown as Record<string, unknown>;
  return Object.entries(v).some(([clave, valor]) => {
    if (sinSeñal.has(clave)) return false;
    if (typeof valor === "string") return valor.trim().length > 0;
    if (typeof valor === "boolean") return valor;
    return false;
  });
}

/** Etiqueta de lo no restaurable para el aviso post-restore. */
export const EMBARQUE_DRAFT_NO_RESTAURADO: readonly string[] = [AVISO_ADJUNTOS];
