import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import type { NavigateFunction } from "react-router-dom";
import type { ConceptoVentaCotizacion, DimensionLCL, DimensionAerea, CotizacionRow, CreateCotizacionInput } from "@/hooks/useCotizaciones";
import type { CostoCotizacion } from "@/hooks/useCotizacionCostos";
import type { FilaCostoLocal } from "@/components/cotizacion/SeccionCostosInternosPLUnificado";
import { buildPaso1Data as buildPaso1Mapper } from "@/lib/mappers/cotizacionMappers";
import { useConceptosVentaCotizacion } from "@/hooks/useConceptosVentaCotizacion";
import { useCotizacionPL } from "@/hooks/useCotizacionPL";
import { getErrorMessage } from "@/lib/errorUtils";
import { savePaso1, savePaso2, savePaso3, savePasoFinal, buildConceptosFromCostos } from "@/lib/cotizacionServices";

// ────────── Form values type ──────────
export interface CotizacionFormValues {
  esProspecto: boolean;
  clienteId: string;
  prospectoEmpresa: string;
  prospectoContacto: string;
  prospectoEmail: string;
  prospectoTelefono: string;
  modo: string;
  tipo: string;
  incoterm: string;
  tipoCarga: string;
  sectorEconomico: string;
  descripcionAdicional: string;
  tipoEmbarque: "FCL" | "LCL";
  tipoContenedor: string;
  tipoPeso: string;
  dimensionesLCL: DimensionLCL[];
  dimensionesAereas: DimensionAerea[];
  pesoKg: number;
  volumenM3: number;
  piezas: number;
  tipoUnidad: string;
  origen: string;
  destino: string;
  tiempoTransitoDias: number | undefined;
  frecuencia: string;
  rutaTexto: string;
  validezPropuesta: Date | undefined;
  tipoMovimiento: string;
  seguro: boolean;
  valorSeguroUsd: number;
  diasLibresDestino: number;
  diasAlmacenaje: number;
  cartaGarantia: boolean;
  notas: string;
  numContenedores: number;
}

export const COTIZACION_FORM_DEFAULTS: CotizacionFormValues = {
  esProspecto: false,
  clienteId: "",
  prospectoEmpresa: "",
  prospectoContacto: "",
  prospectoEmail: "",
  prospectoTelefono: "",
  modo: "Marítimo",
  tipo: "Importación",
  incoterm: "FOB",
  tipoCarga: "Carga General",
  sectorEconomico: "",
  descripcionAdicional: "",
  tipoEmbarque: "FCL",
  tipoContenedor: "",
  tipoPeso: "Peso Normal",
  dimensionesLCL: [{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 }],
  dimensionesAereas: [{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, peso_volumetrico_kg: 0 }],
  pesoKg: 0,
  volumenM3: 0,
  piezas: 0,
  tipoUnidad: "",
  origen: "",
  destino: "",
  tiempoTransitoDias: undefined,
  frecuencia: "",
  rutaTexto: "",
  validezPropuesta: undefined,
  tipoMovimiento: "",
  seguro: false,
  valorSeguroUsd: 0,
  diasLibresDestino: 0,
  diasAlmacenaje: 0,
  cartaGarantia: false,
  notas: "",
  numContenedores: 1,
};

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

interface InitialData {
  id: string;
  estado: string;
  folio: string;
  es_prospecto: boolean;
  cliente_id: string | null;
  prospecto_empresa: string;
  prospecto_contacto: string;
  prospecto_email: string;
  prospecto_telefono: string;
  modo: string;
  tipo: string;
  incoterm: string;
  tipo_carga: string;
  sector_economico: string;
  descripcion_adicional: string;
  tipo_embarque: string;
  tipo_contenedor: string | null;
  tipo_peso: string;
  dimensiones_lcl: DimensionLCL[];
  dimensiones_aereas: DimensionAerea[];
  peso_kg: number;
  volumen_m3: number;
  piezas: number;
  tipo_unidad: string | null;
  origen: string;
  destino: string;
  tiempo_transito_dias: number | null;
  frecuencia: string;
  ruta_texto: string;
  validez_propuesta: string | null;
  tipo_movimiento: string;
  seguro: boolean;
  valor_seguro_usd: number;
  dias_libres_destino: number;
  dias_almacenaje: number;
  carta_garantia: boolean;
  notas: string | null;
  num_contenedores: number;
  conceptos_venta: ConceptoVentaCotizacion[];
  msds_archivo: string | null;
}

interface InitialCosto {
  concepto: string;
  moneda: string;
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta?: number;
  unidad_medida?: string;
}

interface HookDeps {
  navigate: NavigateFunction;
  toast: ToastFn;
  userEmail: string;
  clientes: { id: string; nombre: string }[];
  mutations: Mutations;
  initialData?: InitialData;
  initialCostos?: InitialCosto[];
}

function buildDefaultValues(d?: InitialData): CotizacionFormValues {
  if (!d) return COTIZACION_FORM_DEFAULTS;
  return {
    esProspecto: d.es_prospecto,
    clienteId: d.cliente_id ?? "",
    prospectoEmpresa: d.prospecto_empresa ?? "",
    prospectoContacto: d.prospecto_contacto ?? "",
    prospectoEmail: d.prospecto_email ?? "",
    prospectoTelefono: d.prospecto_telefono ?? "",
    modo: d.modo,
    tipo: d.tipo,
    incoterm: d.incoterm,
    tipoCarga: d.tipo_carga ?? "Carga General",
    sectorEconomico: d.sector_economico ?? "",
    descripcionAdicional: d.descripcion_adicional ?? "",
    tipoEmbarque: (d.tipo_embarque as "FCL" | "LCL") ?? "FCL",
    tipoContenedor: d.tipo_contenedor ?? "",
    tipoPeso: d.tipo_peso ?? "Peso Normal",
    dimensionesLCL: (d.dimensiones_lcl as DimensionLCL[])?.length ? d.dimensiones_lcl as DimensionLCL[] : [{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 }],
    dimensionesAereas: (d.dimensiones_aereas as DimensionAerea[])?.length ? d.dimensiones_aereas as DimensionAerea[] : [{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, peso_volumetrico_kg: 0 }],
    pesoKg: d.peso_kg ?? 0,
    volumenM3: d.volumen_m3 ?? 0,
    piezas: d.piezas ?? 0,
    tipoUnidad: d.tipo_unidad ?? "",
    origen: d.origen ?? "",
    destino: d.destino ?? "",
    tiempoTransitoDias: d.tiempo_transito_dias ?? undefined,
    frecuencia: d.frecuencia ?? "",
    rutaTexto: d.ruta_texto ?? "",
    validezPropuesta: d.validez_propuesta ? new Date(d.validez_propuesta) : undefined,
    tipoMovimiento: d.tipo_movimiento ?? "",
    seguro: d.seguro ?? false,
    valorSeguroUsd: d.valor_seguro_usd ?? 0,
    diasLibresDestino: d.dias_libres_destino ?? 0,
    diasAlmacenaje: d.dias_almacenaje ?? 0,
    cartaGarantia: d.carta_garantia ?? false,
    notas: d.notas ?? "",
    numContenedores: d.num_contenedores ?? 1,
  };
}

export function useCotizacionWizardForm({ navigate, toast, userEmail, clientes, mutations, initialData, initialCostos }: HookDeps) {
  const { crearCotizacion, updateCotizacion, upsertCostos, registrarActividad } = mutations;
  const isEditMode = !!initialData;

  const form = useForm<CotizacionFormValues>({
    defaultValues: buildDefaultValues(initialData),
  });

  const initialConceptosVenta = initialData?.conceptos_venta as ConceptoVentaCotizacion[] | undefined;
  const initialUSD = initialConceptosVenta?.filter(c => c.moneda === "USD") ?? [];
  const initialMXN = initialConceptosVenta?.filter(c => c.moneda === "MXN") ?? [];

  const initialCostosLocales: FilaCostoLocal[] = (initialCostos ?? []).map((c, i) => ({
    _key: `init-${i}`,
    concepto: c.concepto,
    moneda: c.moneda as "USD" | "MXN",
    proveedor: c.proveedor,
    cantidad: c.cantidad,
    costo_unitario: c.costo_unitario,
    precio_venta: c.precio_venta ?? 0,
    unidad_medida: c.unidad_medida ?? "Contenedor",
  }));

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
