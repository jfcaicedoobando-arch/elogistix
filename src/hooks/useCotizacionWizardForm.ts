import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import type { NavigateFunction } from "react-router-dom";
import type { ConceptoVentaCotizacion, DimensionLCL, DimensionAerea, CotizacionRow, CreateCotizacionInput } from "@/hooks/useCotizaciones";
import type { CostoCotizacion } from "@/hooks/useCotizacionCostos";
import type { FilaCostoLocal } from "@/components/cotizacion/SeccionCostosInternosPLUnificado";
import { CONCEPTOS_CON_IVA_USD } from "@/data/cotizacionConstants";
import { calcularTotalConIVA } from "@/lib/financialUtils";
import { useConceptosVentaCotizacion } from "@/hooks/useConceptosVentaCotizacion";
import { useCotizacionPL } from "@/hooks/useCotizacionPL";
import { uploadFile } from "@/lib/storage";

// ────────── Form values type ──────────
export interface CotizacionFormValues {
  // Destinatario
  esProspecto: boolean;
  clienteId: string;
  prospectoEmpresa: string;
  prospectoContacto: string;
  prospectoEmail: string;
  prospectoTelefono: string;
  // Datos generales
  modo: string;
  tipo: string;
  incoterm: string;
  // Mercancía
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
  // Ruta
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
  // Otros
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

// Factories moved to useConceptosVentaCotizacion

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
  conceptos_venta: any;
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

  // ── React Hook Form ──
  const form = useForm<CotizacionFormValues>({
    defaultValues: buildDefaultValues(initialData),
  });

  // ── Pre-fill conceptos from initialData ──
  const initialConceptosVenta = initialData?.conceptos_venta as ConceptoVentaCotizacion[] | undefined;
  const initialUSD = initialConceptosVenta?.filter(c => c.moneda === "USD") ?? [];
  const initialMXN = initialConceptosVenta?.filter(c => c.moneda === "MXN") ?? [];

  // ── Pre-fill costos from initialCostos ──
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

  // ── Non-serializable / external state ──
  const [cotizacionId, setCotizacionId] = useState<string | null>(initialData?.id ?? null);
  const [currentStep, setCurrentStep] = useState(1);
  const [msdsFile, setMsdsFile] = useState<File | null>(null);
  const [costosInternos, setCostosInternos] = useState<FilaCostoLocal[]>(initialCostosLocales);
  const [costosPreLlenados, setCostosPreLlenados] = useState(isEditMode);

  // ── Conceptos de venta (hook extraído) ──
  const conceptos = useConceptosVentaCotizacion({ initialUSD, initialMXN });
  const {
    conceptosUSD, conceptosMXN, setConceptosUSD, setConceptosMXN,
    actualizarConcepto, agregarConcepto, eliminarConcepto,
    totalUSD, subtotalMXN, ivaMXN, totalMXN, tasaIva,
  } = conceptos;

  // ── P&L (hook extraído) ──
  const { costosUSD: costosUSDFiltered, costosMXN: costosMXNFiltered, plUSD, plMXN } = useCotizacionPL(costosInternos);

  // ── Watched derived values ──
  const modo = form.watch("modo");
  const clienteId = form.watch("clienteId");
  const esMaritimo = modo === "Marítimo";
  const esAereo = modo === "Aéreo";
  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

  // ── Helpers mercancía ──
  const handleCambiarTipoEmbarque = useCallback((nuevoTipo: "FCL" | "LCL") => {
    form.setValue("tipoEmbarque", nuevoTipo);
    form.setValue("tipoContenedor", "");
    form.setValue("tipoPeso", "Peso Normal");
    form.setValue("dimensionesLCL", [{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 }]);
    form.setValue("tipoCarga", "Carga General");
    setMsdsFile(null);
  }, [form]);

  // ── Build payload Paso 1 ──
  const buildPaso1Data = useCallback(() => {
    const v = form.getValues();
    const cliente = clientes.find(c => c.id === v.clienteId);
    let pesoFinal = v.pesoKg, volumenFinal = v.volumenM3, piezasFinal = v.piezas;
    const _esMaritimo = v.modo === "Marítimo";
    const _esAereo = v.modo === "Aéreo";
    if (_esMaritimo) {
      pesoFinal = 0;
      volumenFinal = v.tipoEmbarque === "LCL" ? v.dimensionesLCL.reduce((s, d) => s + d.volumen_m3, 0) : 0;
      piezasFinal = v.tipoEmbarque === "LCL" ? v.dimensionesLCL.reduce((s, d) => s + d.piezas, 0) : 0;
    } else if (_esAereo) {
      pesoFinal = v.dimensionesAereas.reduce((s, d) => s + d.peso_volumetrico_kg, 0);
      volumenFinal = 0;
      piezasFinal = v.dimensionesAereas.reduce((s, d) => s + d.piezas, 0);
    }
    return {
      es_prospecto: v.esProspecto,
      cliente_id: v.esProspecto ? null : v.clienteId,
      cliente_nombre: v.esProspecto ? v.prospectoEmpresa : (cliente?.nombre ?? ""),
      prospecto_empresa: v.esProspecto ? v.prospectoEmpresa : "",
      prospecto_contacto: v.esProspecto ? v.prospectoContacto : "",
      prospecto_email: v.esProspecto ? v.prospectoEmail : "",
      prospecto_telefono: v.esProspecto ? v.prospectoTelefono : "",
      modo: v.modo, tipo: v.tipo, incoterm: v.incoterm,
      descripcion_mercancia: v.sectorEconomico,
      peso_kg: pesoFinal, volumen_m3: volumenFinal, piezas: piezasFinal,
      origen: v.origen, destino: v.destino,
      conceptos_venta: [] as ConceptoVentaCotizacion[],
      subtotal: 0,
      moneda: "USD",
      vigencia_dias: v.validezPropuesta ? Math.max(1, Math.ceil((v.validezPropuesta.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 15,
      notas: v.notas,
      operador: userEmail,
      tipo_carga: v.tipoCarga,
      msds_archivo: null as string | null,
      tipo_embarque: _esMaritimo ? v.tipoEmbarque : "FCL",
      tipo_contenedor: _esMaritimo && v.tipoEmbarque === "FCL" ? v.tipoContenedor : null,
      tipo_peso: _esMaritimo && v.tipoEmbarque === "FCL" ? v.tipoPeso : "Peso Normal",
      descripcion_adicional: v.descripcionAdicional,
      sector_economico: v.sectorEconomico,
      dimensiones_lcl: _esMaritimo && v.tipoEmbarque === "LCL" ? v.dimensionesLCL : [],
      dimensiones_aereas: _esAereo ? v.dimensionesAereas : [],
      dias_libres_destino: _esMaritimo && v.tipoEmbarque === "FCL" ? v.diasLibresDestino : 0,
      dias_almacenaje: _esMaritimo && v.tipoEmbarque === "LCL" ? v.diasAlmacenaje : 0,
      carta_garantia: _esMaritimo && v.tipoEmbarque === "FCL" ? v.cartaGarantia : false,
      tiempo_transito_dias: v.tiempoTransitoDias ?? null,
      frecuencia: v.frecuencia,
      ruta_texto: v.rutaTexto,
      validez_propuesta: v.validezPropuesta ? v.validezPropuesta.toISOString().split("T")[0] : null,
      tipo_movimiento: v.tipoMovimiento,
      seguro: v.seguro,
      valor_seguro_usd: v.seguro ? Number(v.valorSeguroUsd) || 0 : 0,
      num_contenedores: v.numContenedores,
      tipo_unidad: v.modo === 'Terrestre' ? v.tipoUnidad : null,
    };
  }, [form, clientes, userEmail]);

  // ── Navegación del wizard ──
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
        let msdsArchivo: string | null = null;
        if (v.tipoCarga === "Mercancía Peligrosa" && msdsFile) {
          const ext = msdsFile.name.split(".").pop() || "pdf";
          const path = `cotizaciones/msds-${Date.now()}.${ext}`;
          await uploadFile(path, msdsFile);
          msdsArchivo = path;
        }
        const data = buildPaso1Data();
        data.msds_archivo = msdsArchivo;
        if (cotizacionId) {
          await updateCotizacion.mutateAsync({ id: cotizacionId, data });
        } else {
          const cotizacion = await crearCotizacion.mutateAsync(data);
          setCotizacionId(cotizacion.id);
        }
        setCurrentStep(2);
      } catch (err: any) {
        toast({ title: "Error al guardar datos generales", description: err.message, variant: "destructive" });
      }
    } else if (currentStep === 2) {
      try {
        if (costosInternos.length > 0 && cotizacionId) {
          const costos: CostoCotizacion[] = costosInternos.map(f => ({
            id: "", cotizacion_id: cotizacionId, concepto: f.concepto, moneda: f.moneda,
            proveedor: f.proveedor, cantidad: f.cantidad, costo_unitario: f.costo_unitario,
            costo_total: f.cantidad * f.costo_unitario, precio_venta: f.precio_venta,
            unidad_medida: f.unidad_medida, created_at: "", updated_at: "",
          }));
          await upsertCostos.mutateAsync({ cotizacionId, costos });
        }
        if (!costosPreLlenados && costosInternos.length > 0) {
          const usdFromCostos = costosInternos
            .filter(c => c.moneda === "USD" && c.concepto.trim())
            .map(c => {
              const tieneIva = (CONCEPTOS_CON_IVA_USD as readonly string[]).includes(c.concepto);
              return {
                descripcion: c.concepto, unidad_medida: c.unidad_medida, cantidad: c.cantidad,
                precio_unitario: c.precio_venta, moneda: "USD" as const, aplica_iva: tieneIva,
                total: tieneIva ? calcularTotalConIVA(c.cantidad * c.precio_venta, tasaIva) : c.cantidad * c.precio_venta,
              };
            });
          const mxnFromCostos = costosInternos
            .filter(c => c.moneda === "MXN" && c.concepto.trim())
            .map(c => ({
              descripcion: c.concepto, unidad_medida: c.unidad_medida, cantidad: c.cantidad,
              precio_unitario: c.precio_venta, moneda: "MXN" as const, aplica_iva: true,
              total: calcularTotalConIVA(c.cantidad * c.precio_venta, tasaIva),
            }));
          if (usdFromCostos.length > 0) setConceptosUSD(usdFromCostos);
          if (mxnFromCostos.length > 0) setConceptosMXN(mxnFromCostos);
          setCostosPreLlenados(true);
        }
        setCurrentStep(3);
      } catch (err: any) {
        toast({ title: "Error al guardar costos", description: err.message, variant: "destructive" });
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
          await updateCotizacion.mutateAsync({
            id: cotizacionId,
            data: { conceptos_venta: [...conceptosUSDValidos, ...conceptosMXNValidos], subtotal: totalUSD },
          });
        }
        setCurrentStep(4);
      } catch (err: any) {
        toast({ title: "Error al guardar conceptos de venta", description: err.message, variant: "destructive" });
      }
    }
  }, [
    currentStep, form, msdsFile,
    buildPaso1Data, cotizacionId, updateCotizacion, crearCotizacion, costosInternos, upsertCostos,
    costosPreLlenados, conceptosUSD, conceptosMXN, totalUSD, toast,
  ]);

  const handleGuardar = useCallback(async () => {
    if (!cotizacionId) return;
    try {
      if (!isEditMode) {
        await updateCotizacion.mutateAsync({ id: cotizacionId, data: { estado: "Borrador" } });
      }
      registrarActividad.mutate({
        accion: isEditMode ? "editar" : "crear", modulo: "cotizaciones",
        entidad_id: cotizacionId, entidad_nombre: "",
      });
      toast({ title: isEditMode ? "Cotización actualizada exitosamente" : "Cotización creada exitosamente" });
      navigate(`/cotizaciones/${cotizacionId}`);
    } catch (err: any) {
      toast({ title: "Error al finalizar cotización", description: err.message, variant: "destructive" });
    }
  }, [cotizacionId, updateCotizacion, registrarActividad, toast, navigate, isEditMode]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep(p => p - 1);
    else navigate("/cotizaciones");
  }, [currentStep, navigate]);

  const isPending = crearCotizacion.isPending || updateCotizacion.isPending || upsertCostos.isPending;

  return {
    // React Hook Form
    form,

    // Wizard
    currentStep, cotizacionId,
    costosInternos, setCostosInternos, costosPreLlenados, isPending,
    msdsFile, setMsdsFile,

    // Derived (watched)
    esMaritimo, esAereo, clienteSeleccionado,
    handleCambiarTipoEmbarque,

    // Conceptos de venta (external state)
    conceptosUSD, conceptosMXN,
    actualizarConcepto, agregarConcepto, eliminarConcepto,
    totalUSD, subtotalMXN, ivaMXN, totalMXN,

    // P&L
    plUSD, plMXN,
    costosUSD: costosUSDFiltered,
    costosMXN: costosMXNFiltered,

    // Acciones
    handleSiguiente, handleGuardar, handleBack,
  };
}
