import { useState, useMemo, useCallback } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from "@/hooks/useCotizaciones";
import type { CostoCotizacion } from "@/hooks/useCotizacionCostos";
import type { FilaCostoLocal } from "@/components/cotizacion/SeccionCostosInternosPLUnificado";
import { CONCEPTOS_CON_IVA_USD } from "@/data/cotizacionConstants";
import { calcularTotalesPL, type TotalesPL } from "@/lib/profitUtils";
import { uploadFile } from "@/lib/storage";

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
  upsertCostos: { mutateAsync: (d: any) => Promise<void>; isPending: boolean };
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

  // ── Wizard ──
  const [cotizacionId, setCotizacionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [numContenedores, setNumContenedores] = useState(1);
  const [costosInternos, setCostosInternos] = useState<FilaCostoLocal[]>([]);
  const [costosPreLlenados, setCostosPreLlenados] = useState(false);

  // ── Destinatario ──
  const [esProspecto, setEsProspecto] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [prospectoEmpresa, setProspectoEmpresa] = useState("");
  const [prospectoContacto, setProspectoContacto] = useState("");
  const [prospectoEmail, setProspectoEmail] = useState("");
  const [prospectoTelefono, setProspectoTelefono] = useState("");

  // ── Datos generales ──
  const [modo, setModo] = useState("Marítimo");
  const [tipo, setTipo] = useState("Importación");
  const [incoterm, setIncoterm] = useState("FOB");

  // ── Mercancía ──
  const [tipoCarga, setTipoCarga] = useState("Carga General");
  const [sectorEconomico, setSectorEconomico] = useState("");
  const [descripcionAdicional, setDescripcionAdicional] = useState("");
  const [msdsFile, setMsdsFile] = useState<File | null>(null);
  const [tipoEmbarque, setTipoEmbarque] = useState<"FCL" | "LCL">("FCL");
  const [tipoContenedor, setTipoContenedor] = useState("");
  const [tipoPeso, setTipoPeso] = useState("Peso Normal");
  const [dimensionesLCL, setDimensionesLCL] = useState<DimensionLCL[]>([
    { piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 },
  ]);
  const [dimensionesAereas, setDimensionesAereas] = useState<DimensionAerea[]>([
    { piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, peso_volumetrico_kg: 0 },
  ]);
  const [pesoKg, setPesoKg] = useState(0);
  const [volumenM3, setVolumenM3] = useState(0);
  const [piezas, setPiezas] = useState(0);

  // ── Ruta ──
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [tiempoTransitoDias, setTiempoTransitoDias] = useState<number | undefined>();
  const [frecuencia, setFrecuencia] = useState("");
  const [rutaTexto, setRutaTexto] = useState("");
  const [validezPropuesta, setValidezPropuesta] = useState<Date | undefined>();
  const [tipoMovimiento, setTipoMovimiento] = useState("");
  const [seguro, setSeguro] = useState(false);
  const [valorSeguroUsd, setValorSeguroUsd] = useState(0);
  const [diasLibresDestino, setDiasLibresDestino] = useState(0);
  const [diasAlmacenaje, setDiasAlmacenaje] = useState(0);
  const [cartaGarantia, setCartaGarantia] = useState(false);

  // ── Conceptos de venta ──
  const [notas, setNotas] = useState("");
  const [conceptosUSD, setConceptosUSD] = useState<ConceptoVentaCotizacion[]>([emptyUSD()]);
  const [conceptosMXN, setConceptosMXN] = useState<ConceptoVentaCotizacion[]>([emptyMXN()]);

  // ── Derivados ──
  const clienteSeleccionado = clientes.find(c => c.id === clienteId);
  const esMaritimo = modo === "Marítimo";
  const esAereo = modo === "Aéreo";

  // ── Helpers mercancía ──
  const handleCambiarTipoEmbarque = useCallback((nuevoTipo: "FCL" | "LCL") => {
    setTipoEmbarque(nuevoTipo);
    setTipoContenedor("");
    setTipoPeso("Peso Normal");
    setDimensionesLCL([{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 }]);
    setTipoCarga("Carga General");
    setMsdsFile(null);
  }, []);

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
  const ivaMXN = subtotalMXN * 0.16;
  const totalMXN = subtotalMXN + ivaMXN;

  const totalPiezasLCL = useMemo(() => dimensionesLCL.reduce((s, d) => s + d.piezas, 0), [dimensionesLCL]);
  const totalVolumenLCL = useMemo(() => dimensionesLCL.reduce((s, d) => s + d.volumen_m3, 0), [dimensionesLCL]);
  const totalPiezasAereas = useMemo(() => dimensionesAereas.reduce((s, d) => s + d.piezas, 0), [dimensionesAereas]);
  const totalPesoVolAereo = useMemo(() => dimensionesAereas.reduce((s, d) => s + d.peso_volumetrico_kg, 0), [dimensionesAereas]);

  // ── P&L ──
  const costosUSD = useMemo(() => costosInternos.filter(c => c.moneda === "USD"), [costosInternos]);
  const costosMXN = useMemo(() => costosInternos.filter(c => c.moneda === "MXN"), [costosInternos]);
  const plUSD: TotalesPL = useMemo(() => calcularTotalesPL(costosUSD), [costosUSD]);
  const plMXN: TotalesPL = useMemo(() => calcularTotalesPL(costosMXN), [costosMXN]);

  // ── Build payload Paso 1 ──
  const buildPaso1Data = useCallback(() => {
    let pesoFinal = pesoKg, volumenFinal = volumenM3, piezasFinal = piezas;
    if (esMaritimo) {
      pesoFinal = 0;
      volumenFinal = tipoEmbarque === "LCL" ? totalVolumenLCL : 0;
      piezasFinal = tipoEmbarque === "LCL" ? totalPiezasLCL : 0;
    } else if (esAereo) {
      pesoFinal = totalPesoVolAereo;
      volumenFinal = 0;
      piezasFinal = totalPiezasAereas;
    }
    return {
      es_prospecto: esProspecto,
      cliente_id: esProspecto ? null : clienteId,
      cliente_nombre: esProspecto ? prospectoEmpresa : (clienteSeleccionado?.nombre ?? ""),
      prospecto_empresa: esProspecto ? prospectoEmpresa : "",
      prospecto_contacto: esProspecto ? prospectoContacto : "",
      prospecto_email: esProspecto ? prospectoEmail : "",
      prospecto_telefono: esProspecto ? prospectoTelefono : "",
      modo, tipo, incoterm,
      descripcion_mercancia: sectorEconomico,
      peso_kg: pesoFinal, volumen_m3: volumenFinal, piezas: piezasFinal,
      origen, destino,
      conceptos_venta: [] as ConceptoVentaCotizacion[],
      subtotal: 0,
      moneda: "USD",
      vigencia_dias: validezPropuesta ? Math.max(1, Math.ceil((validezPropuesta.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 15,
      notas,
      operador: userEmail,
      tipo_carga: tipoCarga,
      msds_archivo: null as string | null,
      tipo_embarque: esMaritimo ? tipoEmbarque : "FCL",
      tipo_contenedor: esMaritimo && tipoEmbarque === "FCL" ? tipoContenedor : null,
      tipo_peso: esMaritimo && tipoEmbarque === "FCL" ? tipoPeso : "Peso Normal",
      descripcion_adicional: descripcionAdicional,
      sector_economico: sectorEconomico,
      dimensiones_lcl: esMaritimo && tipoEmbarque === "LCL" ? dimensionesLCL : [],
      dimensiones_aereas: esAereo ? dimensionesAereas : [],
      dias_libres_destino: esMaritimo && tipoEmbarque === "FCL" ? diasLibresDestino : 0,
      dias_almacenaje: esMaritimo && tipoEmbarque === "LCL" ? diasAlmacenaje : 0,
      carta_garantia: esMaritimo && tipoEmbarque === "FCL" ? cartaGarantia : false,
      tiempo_transito_dias: tiempoTransitoDias ?? null,
      frecuencia,
      ruta_texto: rutaTexto,
      validez_propuesta: validezPropuesta ? validezPropuesta.toISOString().split("T")[0] : null,
      tipo_movimiento: tipoMovimiento,
      seguro,
      valor_seguro_usd: seguro ? Number(valorSeguroUsd) || 0 : 0,
      num_contenedores: numContenedores,
    };
  }, [
    esProspecto, clienteId, clienteSeleccionado, prospectoEmpresa, prospectoContacto, prospectoEmail, prospectoTelefono,
    modo, tipo, incoterm, sectorEconomico, pesoKg, volumenM3, piezas, origen, destino, validezPropuesta, notas, userEmail,
    tipoCarga, tipoEmbarque, tipoContenedor, tipoPeso, descripcionAdicional, dimensionesLCL, dimensionesAereas,
    diasLibresDestino, diasAlmacenaje, cartaGarantia, tiempoTransitoDias, frecuencia, rutaTexto, tipoMovimiento,
    seguro, valorSeguroUsd, numContenedores, esMaritimo, esAereo, totalVolumenLCL, totalPiezasLCL, totalPesoVolAereo, totalPiezasAereas,
  ]);

  // ── Navegación del wizard ──
  const handleSiguiente = useCallback(async () => {
    if (currentStep === 1) {
      if (!esProspecto && !clienteId) {
        toast({ title: "Selecciona un cliente", variant: "destructive" });
        return;
      }
      if (esProspecto && !prospectoEmpresa.trim()) {
        toast({ title: "Ingresa el nombre de la empresa del prospecto", variant: "destructive" });
        return;
      }
      if (esProspecto && !prospectoContacto.trim()) {
        toast({ title: "Ingresa el nombre del contacto del prospecto", variant: "destructive" });
        return;
      }
      try {
        let msdsArchivo: string | null = null;
        if (tipoCarga === "Mercancía Peligrosa" && msdsFile) {
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
    currentStep, esProspecto, clienteId, prospectoEmpresa, prospectoContacto, tipoCarga, msdsFile,
    buildPaso1Data, cotizacionId, updateCotizacion, crearCotizacion, costosInternos, upsertCostos,
    costosPreLlenados, conceptosUSD, conceptosMXN, totalUSD, toast,
  ]);

  const handleGuardar = useCallback(async () => {
    if (!cotizacionId) return;
    try {
      await updateCotizacion.mutateAsync({ id: cotizacionId, data: { estado: "Borrador" } as any });
      registrarActividad.mutate({
        accion: "Crear cotización", modulo: "Cotizaciones",
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
    // Wizard
    currentStep, cotizacionId, numContenedores, setNumContenedores,
    costosInternos, setCostosInternos, costosPreLlenados, isPending,

    // Destinatario
    esProspecto, setEsProspecto, clienteId, setClienteId,
    prospectoEmpresa, setProspectoEmpresa, prospectoContacto, setProspectoContacto,
    prospectoEmail, setProspectoEmail, prospectoTelefono, setProspectoTelefono,

    // Datos generales
    modo, setModo, tipo, setTipo, incoterm, setIncoterm,

    // Mercancía
    tipoCarga, setTipoCarga, sectorEconomico, setSectorEconomico,
    descripcionAdicional, setDescripcionAdicional, msdsFile, setMsdsFile,
    tipoEmbarque, tipoContenedor, setTipoContenedor, tipoPeso, setTipoPeso,
    dimensionesLCL, setDimensionesLCL, dimensionesAereas, setDimensionesAereas,
    pesoKg, setPesoKg, volumenM3, setVolumenM3, piezas, setPiezas,
    handleCambiarTipoEmbarque,

    // Ruta
    origen, setOrigen, destino, setDestino,
    tiempoTransitoDias, setTiempoTransitoDias, frecuencia, setFrecuencia,
    rutaTexto, setRutaTexto, validezPropuesta, setValidezPropuesta,
    tipoMovimiento, setTipoMovimiento, seguro, setSeguro,
    valorSeguroUsd, setValorSeguroUsd, diasLibresDestino, setDiasLibresDestino,
    diasAlmacenaje, setDiasAlmacenaje, cartaGarantia, setCartaGarantia,

    // Conceptos de venta
    notas, setNotas, conceptosUSD, conceptosMXN,
    actualizarConcepto, agregarConcepto, eliminarConcepto,
    totalUSD, subtotalMXN, ivaMXN, totalMXN,

    // Derivados
    clienteSeleccionado, esMaritimo, esAereo,
    plUSD, plMXN, costosUSD, costosMXN,

    // Acciones
    handleSiguiente, handleGuardar, handleBack,
  };
}
