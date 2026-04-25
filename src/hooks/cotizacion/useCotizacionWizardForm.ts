import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import type { NavigateFunction } from "react-router-dom";
import type { ConceptoVentaCotizacion, CotizacionRow, CreateCotizacionInput } from "@/hooks/useCotizaciones";
import type { CostoCotizacion } from "@/hooks/cotizacion/useCotizacionCostos";
import type { FilaCostoLocal } from "@/types/cotizacionPLTypes";
import { buildPaso1Data as buildPaso1Mapper } from "@/lib/mappers/cotizacion";
import {
  buildCotizacionDefaultValues,
  buildCotizacionInitialCostos,
  type CotizacionFormValues,
  type CotizacionInitialData,
  type CotizacionInitialCosto,
} from "@/lib/mappers/cotizacionForm";
import { useConceptosVentaCotizacion } from "@/hooks/cotizacion/useConceptosVentaCotizacion";
import { useCotizacionPL } from "@/hooks/cotizacion/useCotizacionPL";
import { useCotizacionWizardSteps } from "@/hooks/cotizacion/useCotizacionWizardSteps";

// Re-exports para preservar la API pública existente
export { COTIZACION_FORM_DEFAULTS } from "@/lib/mappers/cotizacionForm";
export type { CotizacionFormValues } from "@/lib/mappers/cotizacionForm";

// ────────── Types ──────────
interface ToastFn {
  (opts: { title: string; description?: string; variant?: "destructive" | "default" }): void;
}

interface Mutations {
  crearCotizacion: { mutateAsync: (d: CreateCotizacionInput) => Promise<CotizacionRow>; isPending: boolean };
  updateCotizacion: { mutateAsync: (d: { id: string; data: Partial<CreateCotizacionInput> & Record<string, unknown> }) => Promise<void>; isPending: boolean };
  upsertCostos: { mutateAsync: (d: { cotizacionId: string; costos: CostoCotizacion[] }) => Promise<CostoCotizacion[]>; isPending: boolean };
  registrarActividad: { mutate: (d: { accion: string; modulo: string; entidad_id?: string | null; entidad_nombre?: string; detalles?: Record<string, unknown> }) => void };
}

interface HookDeps {
  navigate: NavigateFunction;
  toast: ToastFn;
  userEmail: string;
  clientes: { id: string; nombre: string }[];
  mutations: Mutations;
  initialData?: CotizacionInitialData;
  initialCostos?: CotizacionInitialCosto[];
}

/**
 * Orquestador del wizard de cotización.
 * Combina form-state + cálculos + handlers de pasos (delegados a useCotizacionWizardSteps).
 */
export function useCotizacionWizardForm({ navigate, toast, userEmail, clientes, mutations, initialData, initialCostos }: HookDeps) {
  const { crearCotizacion, updateCotizacion, upsertCostos } = mutations;
  const isEditMode = !!initialData;

  const form = useForm<CotizacionFormValues>({
    defaultValues: buildCotizacionDefaultValues(initialData),
  });

  const initialConceptosVenta = initialData?.conceptos_venta as ConceptoVentaCotizacion[] | undefined;
  const initialUSD = initialConceptosVenta?.filter(c => c.moneda === "USD") ?? [];
  const initialMXN = initialConceptosVenta?.filter(c => c.moneda === "MXN") ?? [];

  const initialCostosLocales: FilaCostoLocal[] = buildCotizacionInitialCostos(initialCostos);

  const [cotizacionId, setCotizacionId] = useState<string | null>(initialData?.id ?? null);
  const [currentStep, setCurrentStep] = useState(1);
  const [msdsFile, setMsdsFile] = useState<File | null>(null);
  const [costosInternos, setCostosInternos] = useState<FilaCostoLocal[]>(initialCostosLocales);
  const [costosPreLlenados, setCostosPreLlenados] = useState(isEditMode);

  const conceptos = useConceptosVentaCotizacion({ initialUSD, initialMXN });
  const {
    conceptosUSD, conceptosMXN, setConceptosUSD, setConceptosMXN,
    actualizarConcepto, agregarConcepto, eliminarConcepto,
    totalUSD, subtotalMXN, ivaMXN, totalMXN, tasaIva,
  } = conceptos;

  const { costosUSD: costosUSDFiltered, costosMXN: costosMXNFiltered, plUSD, plMXN } = useCotizacionPL(costosInternos);

  const modo = form.watch("modo");
  const clienteId = form.watch("clienteId");
  const esMaritimo = modo === "Marítimo";
  const esAereo = modo === "Aéreo";
  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

  const handleCambiarTipoEmbarque = useCallback((nuevoTipo: "FCL" | "LCL") => {
    form.setValue("tipoEmbarque", nuevoTipo);
    form.setValue("tipoContenedor", "");
    form.setValue("tipoPeso", "Peso Normal");
    form.setValue("dimensionesLCL", [{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 }]);
    form.setValue("tipoCarga", "Carga General");
    setMsdsFile(null);
  }, [form]);

  const buildPaso1Data = useCallback(() => {
    return buildPaso1Mapper(form.getValues(), clientes, userEmail);
  }, [form, clientes, userEmail]);

  // ── Handlers de navegación del wizard (hook dedicado) ──
  const { handleSiguiente, handleGuardar, handleBack } = useCotizacionWizardSteps({
    form, toast, navigate, isEditMode,
    cotizacionId, setCotizacionId,
    currentStep, setCurrentStep,
    msdsFile, costosInternos, costosPreLlenados, setCostosPreLlenados,
    conceptosUSD, conceptosMXN, setConceptosUSD, setConceptosMXN,
    totalUSD, tasaIva, buildPaso1Data,
    mutations,
  });

  const isPending = crearCotizacion.isPending || updateCotizacion.isPending || upsertCostos.isPending;

  return {
    form,
    currentStep, cotizacionId,
    costosInternos, setCostosInternos, costosPreLlenados, isPending,
    msdsFile, setMsdsFile,
    esMaritimo, esAereo, clienteSeleccionado,
    handleCambiarTipoEmbarque,
    conceptosUSD, conceptosMXN,
    actualizarConcepto, agregarConcepto, eliminarConcepto,
    totalUSD, subtotalMXN, ivaMXN, totalMXN,
    plUSD, plMXN,
    costosUSD: costosUSDFiltered,
    costosMXN: costosMXNFiltered,
    handleSiguiente, handleGuardar, handleBack,
  };
}
