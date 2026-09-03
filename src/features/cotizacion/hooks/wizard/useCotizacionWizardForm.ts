import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import type { NavigateFunction } from "react-router-dom";
import type { ConceptoVentaCotizacion, CotizacionRow, CreateCotizacionInput } from "@/features/cotizacion/hooks/useCotizaciones";
import type { CostoCotizacion } from "@/features/cotizacion/hooks/useCotizacionCostos";
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import { buildPaso1Data as buildPaso1Mapper } from "@/features/cotizacion/domain/mappers/cotizacion";
import {
  buildCotizacionDefaultValues,
  buildCotizacionInitialCostos,
  type CotizacionFormValues,
  type CotizacionInitialData,
  type CotizacionInitialCosto,
} from "@/features/cotizacion/domain/mappers/cotizacionForm";
import { useConceptosVentaCotizacion } from "@/features/cotizacion/hooks/useConceptosVentaCotizacion";
import { useCotizacionPL } from "@/features/cotizacion/hooks/useCotizacionPL";
import { useCotizacionWizardSteps } from "@/features/cotizacion/hooks/wizard/useCotizacionWizardSteps";
import { useCotizacionUpdateGuard } from "@/features/cotizacion/hooks/wizard/useCotizacionUpdateGuard";

// Re-exports para preservar la API pública existente
;
export type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";

// ────────── Types ──────────
interface ToastFn {
  (opts: { title: string; description?: string; variant?: "destructive" | "default" }): void;
}

interface Mutations {
  crearCotizacion: { mutateAsync: (d: CreateCotizacionInput) => Promise<CotizacionRow>; isPending: boolean };
  updateCotizacion: { mutateAsync: (d: { id: string; data: Partial<CreateCotizacionInput> & Record<string, unknown> }) => Promise<unknown>; isPending: boolean };
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
  /** v13.293.0 (P0): callback opcional para mostrar success dialog en vez de navegar. */
  onFinalized?: (cotizacionId: string) => void;
}

/**
 * Orquestador del wizard de cotización.
 * Combina form-state + cálculos + handlers de pasos (delegados a useCotizacionWizardSteps).
 */
export function useCotizacionWizardForm({ navigate, toast, userEmail, clientes, mutations, initialData, initialCostos, onFinalized }: HookDeps) {
  const { crearCotizacion, updateCotizacion, upsertCostos } = mutations;
  const isEditMode = !!initialData;

  // N-06 (QA r2): todas las escrituras del wizard viajan con el `updated_at`
  // leído al abrir la cotización; si otra sesión la modificó, el guardado se
  // rechaza con LC_CONFLICTO_CONCURRENCIA en vez de pisar cambios ajenos.
  // v13.823.15: al CREAR también se siembra el sello con el `updated_at` de la
  // fila nueva; sin eso el segundo guardado del mismo usuario daba un conflicto
  // falso (la base firma la fila al insertarla).
  const updateGuardado = useCotizacionUpdateGuard(updateCotizacion, initialData?.updated_at, crearCotizacion);
  const mutationsGuardadas = {
    ...mutations,
    updateCotizacion: updateGuardado,
    crearCotizacion: updateGuardado.crearCotizacion ?? crearCotizacion,
  };


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
    actualizarConcepto, agregarConcepto, agregarConceptoPrefill, eliminarConcepto,
    totalUSD, subtotalMXN, ivaMXN, totalMXN, tasaIva,
  } = conceptos;

  const { costosUSD: costosUSDFiltered, costosMXN: costosMXNFiltered, plUSD, plMXN } = useCotizacionPL(costosInternos);

  const modo = form.watch("modo");
  const clienteId = form.watch("clienteId");
  const esMaritimo = modo === "Marítimo";
  const esAereo = modo === "Aéreo";
  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

  const handleCambiarTipoEmbarque = useCallback((nuevoTipo: "FCL" | "LCL") => {
    // 12.35.0: setValue con shouldValidate/shouldDirty + trigger() para que el wizard
    // recalcule errors y avance step (mem://core RHF rule).
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    form.setValue("tipoEmbarque", nuevoTipo, opts);
    form.setValue("tipoContenedor", "", opts);
    form.setValue("tipoPeso", "Peso Normal", opts);
    form.setValue("dimensionesLCL", [{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 }], opts);
    form.setValue("tipoCarga", "Carga General", opts);
    // v13.299.1: al pasar a LCL se elimina la tarifa marítima vinculada
    // (LCL captura flete manual). Evita estado huérfano heredado de FCL.
    if (nuevoTipo === "LCL") {
      form.setValue("tarifaId", null, opts);
      form.setValue("tarifaOverride", {}, opts);
    }
    void form.trigger(["tipoEmbarque", "tipoContenedor", "tipoPeso", "dimensionesLCL", "tipoCarga", "tarifaId"]);
    setMsdsFile(null);
  }, [form]);

  const buildPaso1Data = useCallback(() => {
    return buildPaso1Mapper(form.getValues(), clientes, userEmail);
  }, [form, clientes, userEmail]);

  // ── Handlers de navegación del wizard (hook dedicado) ──
  const { handleSiguiente, handleGuardar, handleBack, handleCotizarSinDesglose, vinculoCrmError, vinculoCrmConfirmado, limpiarVinculoCrmError } = useCotizacionWizardSteps({
    form, toast, navigate, isEditMode, estadoInicial: initialData?.estado ?? null,
    cotizacionId, setCotizacionId,
    currentStep, setCurrentStep,
    msdsFile, costosInternos, costosPreLlenados, setCostosPreLlenados,
    conceptosUSD, conceptosMXN, setConceptosUSD, setConceptosMXN,
    totalUSD, tasaIva, buildPaso1Data,
    mutations: mutationsGuardadas, onFinalized,
  });

  const isPending = crearCotizacion.isPending || updateCotizacion.isPending || upsertCostos.isPending;

  return {
    form,
    currentStep, setCurrentStep, cotizacionId, setCotizacionId,
    costosInternos, setCostosInternos, costosPreLlenados, isPending,
    msdsFile, setMsdsFile,
    esMaritimo, esAereo, clienteSeleccionado,
    handleCambiarTipoEmbarque,
    conceptosUSD, conceptosMXN,
    actualizarConcepto, agregarConcepto, agregarConceptoPrefill, eliminarConcepto,
    totalUSD, subtotalMXN, ivaMXN, totalMXN,
    plUSD, plMXN,
    costosUSD: costosUSDFiltered,
    costosMXN: costosMXNFiltered,
    handleSiguiente, handleGuardar, handleBack, handleCotizarSinDesglose,
    vinculoCrmError, vinculoCrmConfirmado, limpiarVinculoCrmError,
  };
}
