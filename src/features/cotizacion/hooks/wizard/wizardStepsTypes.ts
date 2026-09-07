/**
 * Tipos y utilidades puras del wizard de cotización.
 * Extraído de `useCotizacionWizardSteps.ts` para mantener ambos archivos
 * bajo 200 líneas (Power-of-10).
 */
import type { UseFormReturn } from "react-hook-form";
import type { NavigateFunction } from "react-router-dom";
import type { CostoCotizacion } from "@/features/cotizacion/hooks/useCotizacionCostos";
import type {
  CreateCotizacionInput,
  CotizacionRow,
  ConceptoVentaCotizacion,
} from "@/features/cotizacion/hooks/useCotizaciones";
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";

/**
 * Firma estable de las filas de costos internos usadas para decidir cuándo
 * regenerar los conceptos de venta del paso 3. Solo campos que impactan el
 * output de `buildConceptosFromCostos`.
 */
export function firmaCostos(costos: FilaCostoLocal[]): string {
  return JSON.stringify(
    costos.map(c => ({
      c: c.concepto,
      m: c.moneda,
      u: c.unidad_medida,
      q: c.cantidad,
      p: c.precio_venta,
    })),
  );
}

export interface ToastFn {
  (opts: { title: string; description?: string; variant?: "destructive" | "default" }): void;
}

export interface StepMutations {
  crearCotizacion: { mutateAsync: (d: CreateCotizacionInput) => Promise<CotizacionRow>; isPending: boolean };
  updateCotizacion: {
    mutateAsync: (d: { id: string; data: Partial<CreateCotizacionInput> & Record<string, unknown> }) => Promise<unknown>;
    isPending: boolean;
    /** P0: refresca el sello optimista tras el vínculo CRM. */
    resincronizarSello?: (sello: string | null) => void;
    /** v13.823.69: sello vigente, para que el paso 2 viaje con el mismo candado. */
    selloActual?: () => string | null;
  };
  upsertCostos: {
    mutateAsync: (d: {
      cotizacionId: string;
      costos: CostoCotizacion[];
      expectedUpdatedAt?: string | null;
      // v13.823.169: sello de la escritura propia; la fotografía posterior va
      // aparte (`snapshot`) y no autoriza capturas viejas.
    }) => Promise<{ updatedAt: string | null }>;
    isPending: boolean;
  };
  registrarActividad: { mutate: (d: { accion: string; modulo: string; entidad_id?: string | null; entidad_nombre?: string; detalles?: Record<string, unknown> }) => void };
}

export interface WizardStepsDeps {
  form: UseFormReturn<CotizacionFormValues>;
  toast: ToastFn;
  navigate: NavigateFunction;
  isEditMode: boolean;
  /** Estado con el que se abrió el wizard (P0-1 R5: `Solicitada` pasa a `Borrador`). */
  estadoInicial?: string | null;
  cotizacionId: string | null;
  setCotizacionId: (id: string) => void;
  currentStep: number;
  setCurrentStep: (step: number | ((p: number) => number)) => void;
  msdsFile: File | null;
  costosInternos: FilaCostoLocal[];
  costosPreLlenados: boolean;
  setCostosPreLlenados: (v: boolean) => void;
  conceptosUSD: ConceptoVentaCotizacion[];
  conceptosMXN: ConceptoVentaCotizacion[];
  setConceptosUSD: (c: ConceptoVentaCotizacion[]) => void;
  setConceptosMXN: (c: ConceptoVentaCotizacion[]) => void;
  totalUSD: number;
  tasaIva: number;
  buildPaso1Data: () => Record<string, unknown>;
  mutations: StepMutations;
  /** v13.293.0 (P0): si se pasa, se llama en lugar de navegar tras guardar. */
  onFinalized?: (cotizacionId: string) => void;
}
