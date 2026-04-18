import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import type { NavigateFunction } from "react-router-dom";
import type { ConceptoVentaCotizacion, CotizacionRow, CreateCotizacionInput } from "@/hooks/useCotizaciones";
import type { CostoCotizacion } from "@/hooks/useCotizacionCostos";
import type { FilaCostoLocal } from "@/components/cotizacion/SeccionCostosInternosPLUnificado";
import { buildPaso1Data as buildPaso1Mapper } from "@/lib/mappers/cotizacionMappers";
import {
  buildCotizacionDefaultValues,
  buildCotizacionInitialCostos,
  type CotizacionFormValues,
  type CotizacionInitialData,
  type CotizacionInitialCosto,
} from "@/lib/cotizacionFormMappers";
import { useConceptosVentaCotizacion } from "@/hooks/useConceptosVentaCotizacion";
import { useCotizacionPL } from "@/hooks/useCotizacionPL";
import { getErrorMessage } from "@/lib/errorUtils";
import { savePaso1, savePaso2, savePaso3, savePasoFinal, buildConceptosFromCostos } from "@/lib/cotizacionServices";

// Re-exports para preservar la API pública existente
export { COTIZACION_FORM_DEFAULTS } from "@/lib/cotizacionFormMappers";
export type { CotizacionFormValues } from "@/lib/cotizacionFormMappers";

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

export function useCotizacionWizardForm({ navigate, toast, userEmail, clientes, mutations, initialData, initialCostos }: HookDeps) {
  const { crearCotizacion, updateCotizacion, upsertCostos, registrarActividad } = mutations;
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

  // ── Navegación del wizard (usa cotizacionServices) ──
  const handleSiguiente = useCallback(async () => {
    const v = form.getValues();
    if (currentStep === 1) {
      if (!v.esProspecto && !v.clienteId) {
        toast({ title: "Selecciona un cliente", variant: "destructive" });
        return;
      }
      if (v.esProspecto && !v.prospectoEmpresa.trim()) {
        toast({ title: "Ingresa el nombre de la empresa del prospecto", variant: "destructive" });
        return;
      }
      if (v.esProspecto && !v.prospectoContacto.trim()) {
        toast({ title: "Ingresa el nombre del contacto del prospecto", variant: "destructive" });
        return;
      }
      try {
        const id = await savePaso1({
          form, msdsFile, cotizacionId, buildPaso1Data,
          mutations: { crearCotizacion, updateCotizacion },
        });
        if (!cotizacionId) setCotizacionId(id);
        setCurrentStep(2);
      } catch (err: unknown) {
        toast({ title: "Error al guardar datos generales", description: getErrorMessage(err), variant: "destructive" });
      }
    } else if (currentStep === 2) {
      try {
        if (costosInternos.length > 0 && cotizacionId) {
          await savePaso2({ cotizacionId, costosInternos, mutations: { upsertCostos } });
        }
        if (!costosPreLlenados && costosInternos.length > 0) {
          const { usd, mxn } = buildConceptosFromCostos(costosInternos, tasaIva);
          if (usd.length > 0) setConceptosUSD(usd);
          if (mxn.length > 0) setConceptosMXN(mxn);
          setCostosPreLlenados(true);
        }
        setCurrentStep(3);
      } catch (err: unknown) {
        toast({ title: "Error al guardar costos", description: getErrorMessage(err), variant: "destructive" });
      }
    } else if (currentStep === 3) {
      const conceptosUSDValidos = conceptosUSD.filter(c => c.descripcion?.trim());
      const conceptosMXNValidos = conceptosMXN.filter(c => c.descripcion?.trim());
      if (conceptosUSDValidos.length === 0 && conceptosMXNValidos.length === 0) {
        toast({ title: "Agrega al menos un concepto de venta", variant: "destructive" });
        return;
      }
      try {
        if (cotizacionId) {
          await savePaso3({
            cotizacionId,
            conceptosVenta: [...conceptosUSDValidos, ...conceptosMXNValidos] as unknown as Record<string, unknown>[],
            totalUSD,
            mutations: { updateCotizacion },
          });
        }
        setCurrentStep(4);
      } catch (err: unknown) {
        toast({ title: "Error al guardar conceptos de venta", description: getErrorMessage(err), variant: "destructive" });
      }
    }
  }, [
    currentStep, form, msdsFile,
    buildPaso1Data, cotizacionId, updateCotizacion, crearCotizacion, costosInternos, upsertCostos,
    costosPreLlenados, conceptosUSD, conceptosMXN, totalUSD, toast, tasaIva,
    setConceptosUSD, setConceptosMXN,
  ]);

  const handleGuardar = useCallback(async () => {
    if (!cotizacionId) return;
    try {
      await savePasoFinal({
        cotizacionId, isEditMode,
        mutations: { updateCotizacion },
        registrarActividad: registrarActividad.mutate,
      });
      toast({ title: isEditMode ? "Cotización actualizada exitosamente" : "Cotización creada exitosamente" });
      navigate(`/cotizaciones/${cotizacionId}`);
    } catch (err: unknown) {
      toast({ title: "Error al finalizar cotización", description: getErrorMessage(err), variant: "destructive" });
    }
  }, [cotizacionId, updateCotizacion, registrarActividad, toast, navigate, isEditMode]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep(p => p - 1);
    else navigate("/cotizaciones");
  }, [currentStep, navigate]);

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
