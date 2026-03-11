import { useState, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import type { NavigateFunction } from "react-router-dom";
import type { ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from "@/hooks/useCotizaciones";
import type { CostoCotizacion } from "@/hooks/useCotizacionCostos";
import type { FilaCostoLocal } from "@/components/cotizacion/SeccionCostosInternosPLUnificado";
import { CONCEPTOS_CON_IVA_USD } from "@/data/cotizacionConstants";
import { calcularTotalesPL, type TotalesPL } from "@/lib/profitUtils";
import { calcularIVA, calcularTotalConIVA } from "@/lib/financialUtils";
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

// ────────── Factories ──────────
const emptyUSD = (): ConceptoVentaCotizacion => ({
  descripcion: "", unidad_medida: "", cantidad: 1, precio_unitario: 0, moneda: "USD", total: 0, aplica_iva: false,
});
const emptyMXN = (): ConceptoVentaCotizacion => ({
  descripcion: "", unidad_medida: "", cantidad: 1, precio_unitario: 0, moneda: "MXN", total: 0, aplica_iva: true,
});

// ────────── Types ──────────
interface ToastFn {
  (opts: { title: string; description?: string; variant?: "destructive" | "default" }): void;
}

interface Mutations {
  crearCotizacion: { mutateAsync: (d: any) => Promise<any>; isPending: boolean };
  updateCotizacion: { mutateAsync: (d: any) => Promise<void>; isPending: boolean };
  upsertCostos: { mutateAsync: (d: any) => Promise<any>; isPending: boolean };
  registrarActividad: { mutate: (d: any) => void };
}

interface HookDeps {
  navigate: NavigateFunction;
  toast: ToastFn;
  userEmail: string;
  clientes: { id: string; nombre: string }[];
  mutations: Mutations;
}

export function useCotizacionWizardForm({ navigate, toast, userEmail, clientes, mutations }: HookDeps) {
  const { crearCotizacion, updateCotizacion, upsertCostos, registrarActividad } = mutations;

  // ── React Hook Form ──
  const form = useForm<CotizacionFormValues>({
    defaultValues: COTIZACION_FORM_DEFAULTS,
  });

  // ── Non-serializable / external state ──
  const [cotizacionId, setCotizacionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [msdsFile, setMsdsFile] = useState<File | null>(null);
  const [costosInternos, setCostosInternos] = useState<FilaCostoLocal[]>([]);
  const [costosPreLlenados, setCostosPreLlenados] = useState(false);
  const [conceptosUSD, setConceptosUSD] = useState<ConceptoVentaCotizacion[]>([emptyUSD()]);
  const [conceptosMXN, setConceptosMXN] = useState<ConceptoVentaCotizacion[]>([emptyMXN()]);

  // ── Watched derived values ──
  const modo = form.watch("modo");
  const tipoEmbarque = form.watch("tipoEmbarque");
  const esProspecto = form.watch("esProspecto");
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

  // ── Helpers conceptos ──
  const actualizarConcepto = useCallback((moneda: "USD" | "MXN", index: number, campo: string, valor: any) => {
    if (campo === "_esOtro") return;
    const setter = moneda === "USD" ? setConceptosUSD : setConceptosMXN;
    setter(prev => {
      const copia = [...prev];
      (copia[index] as any)[campo] = valor;
      if (moneda === "USD" && campo === "descripcion" && !(CONCEPTOS_CON_IVA_USD as readonly string[]).includes(valor)) {
        copia[index].aplica_iva = false;
      }
      const sub = copia[index].cantidad * copia[index].precio_unitario;
      copia[index].total = moneda === "MXN" ? sub * 1.16 : sub * (copia[index].aplica_iva ? 1.16 : 1);
      return copia;
    });
  }, []);

  const agregarConcepto = useCallback((moneda: "USD" | "MXN") => {
    const setter = moneda === "USD" ? setConceptosUSD : setConceptosMXN;
    const factory = moneda === "USD" ? emptyUSD : emptyMXN;
    setter(prev => [...prev, factory()]);
  }, []);

  const eliminarConcepto = useCallback((moneda: "USD" | "MXN", index: number) => {
    const setter = moneda === "USD" ? setConceptosUSD : setConceptosMXN;
    setter(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // ── Totales ──
  const totalUSD = useMemo(() => conceptosUSD.reduce((s, c) => s + c.total, 0), [conceptosUSD]);
  const subtotalMXN = useMemo(() => conceptosMXN.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0), [conceptosMXN]);
  const ivaMXN = useMemo(() => calcularIVA(subtotalMXN), [subtotalMXN]);
  const totalMXN = useMemo(() => calcularTotalConIVA(subtotalMXN), [subtotalMXN]);

  // ── Dimension totals (watched) ──
  const dimensionesLCL = form.watch("dimensionesLCL");
  const dimensionesAereas = form.watch("dimensionesAereas");
  const totalPiezasLCL = useMemo(() => dimensionesLCL.reduce((s, d) => s + d.piezas, 0), [dimensionesLCL]);
  const totalVolumenLCL = useMemo(() => dimensionesLCL.reduce((s, d) => s + d.volumen_m3, 0), [dimensionesLCL]);
  const totalPiezasAereas = useMemo(() => dimensionesAereas.reduce((s, d) => s + d.piezas, 0), [dimensionesAereas]);
  const totalPesoVolAereo = useMemo(() => dimensionesAereas.reduce((s, d) => s + d.peso_volumetrico_kg, 0), [dimensionesAereas]);

  // ── P&L ──
  const costosUSDFiltered = useMemo(() => costosInternos.filter(c => c.moneda === "USD"), [costosInternos]);
  const costosMXNFiltered = useMemo(() => costosInternos.filter(c => c.moneda === "MXN"), [costosInternos]);
  const plUSD: TotalesPL = useMemo(() => calcularTotalesPL(costosUSDFiltered), [costosUSDFiltered]);
  const plMXN: TotalesPL = useMemo(() => calcularTotalesPL(costosMXNFiltered), [costosMXNFiltered]);

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
                total: c.cantidad * c.precio_venta * (tieneIva ? 1.16 : 1),
              };
            });
          const mxnFromCostos = costosInternos
            .filter(c => c.moneda === "MXN" && c.concepto.trim())
            .map(c => ({
              descripcion: c.concepto, unidad_medida: c.unidad_medida, cantidad: c.cantidad,
              precio_unitario: c.precio_venta, moneda: "MXN" as const, aplica_iva: true,
              total: c.cantidad * c.precio_venta * 1.16,
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
      await updateCotizacion.mutateAsync({ id: cotizacionId, data: { estado: "Borrador" } as any });
      registrarActividad.mutate({
        accion: "crear", modulo: "cotizaciones",
        entidad_id: cotizacionId, entidad_nombre: "",
      });
      toast({ title: "Cotización creada exitosamente" });
      navigate(`/cotizaciones/${cotizacionId}`);
    } catch (err: any) {
      toast({ title: "Error al finalizar cotización", description: err.message, variant: "destructive" });
    }
  }, [cotizacionId, updateCotizacion, registrarActividad, toast, navigate]);

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
