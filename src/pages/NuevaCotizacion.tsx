import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useClientesForSelect } from "@/hooks/useClientes";
import { useCreateCotizacion, useUpdateCotizacion, ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from "@/hooks/useCotizaciones";
import { useUpsertCotizacionCostos, CostoCotizacion } from "@/hooks/useCotizacionCostos";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFile } from "@/lib/storage";
import { formatCurrency } from "@/lib/formatters";
import { calcularTotalesPL } from "@/lib/profitUtils";
import { ArrowLeft, Save, ChevronRight, ChevronLeft, Info, Package } from "lucide-react";

import { StepIndicator } from "@/components/embarque/StepIndicator";
import SeccionDestinatario from "@/components/cotizacion/SeccionDestinatario";
import SeccionDatosGeneralesCotizacion from "@/components/cotizacion/SeccionDatosGeneralesCotizacion";
import SeccionRutaCotizacion from "@/components/cotizacion/SeccionRutaCotizacion";
import SeccionConceptosVentaCotizacion from "@/components/cotizacion/SeccionConceptosVentaCotizacion";
import { CONCEPTOS_CON_IVA_USD } from "@/data/cotizacionConstants";
import SeccionMercanciaMaritimaFCL from "@/components/cotizacion/SeccionMercanciaMaritimaFCL";
import SeccionMercanciaMaritimeLCL from "@/components/cotizacion/SeccionMercanciaMaritimeLCL";
import SeccionMercanciaGeneral from "@/components/cotizacion/SeccionMercanciaGeneral";
import SeccionMercanciaAerea from "@/components/cotizacion/SeccionMercanciaAerea";
import SeccionCostosInternosPLLocal, { type FilaCostoLocal } from "@/components/cotizacion/SeccionCostosInternosPLLocal";
import PasoResumenCotizacion from "@/components/cotizacion/PasoResumenCotizacion";


const WIZARD_STEPS = [
  { num: 1, title: 'Datos Generales' },
  { num: 2, title: 'Costos & P&L' },
  { num: 3, title: 'Cotización Cliente' },
  { num: 4, title: 'Resumen' },
];

const emptyUSD = (): ConceptoVentaCotizacion => ({
  descripcion: '', unidad_medida: '', cantidad: 1, precio_unitario: 0, moneda: 'USD', total: 0, aplica_iva: false,
});
const emptyMXN = (): ConceptoVentaCotizacion => ({
  descripcion: '', unidad_medida: '', cantidad: 1, precio_unitario: 0, moneda: 'MXN', total: 0, aplica_iva: true,
});

export default function NuevaCotizacion() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: clientes = [] } = useClientesForSelect();
  const crearCotizacion = useCreateCotizacion();
  const updateCotizacion = useUpdateCotizacion();
  const upsertCostos = useUpsertCotizacionCostos();
  const registrarActividad = useRegistrarActividad();

  // Wizard state
  const [cotizacionId, setCotizacionId] = useState<string | null>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [numContenedores, setNumContenedores] = useState(1);
  const [costosInternos, setCostosInternos] = useState<FilaCostoLocal[]>([]);
  const [costosPreLlenados, setCostosPreLlenados] = useState(false);

  // Destinatario
  const [esProspecto, setEsProspecto] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [prospectoEmpresa, setProspectoEmpresa] = useState("");
  const [prospectoContacto, setProspectoContacto] = useState("");
  const [prospectoEmail, setProspectoEmail] = useState("");
  const [prospectoTelefono, setProspectoTelefono] = useState("");

  // Datos generales
  const [modo, setModo] = useState("Marítimo");
  const [tipo, setTipo] = useState("Importación");
  const [incoterm, setIncoterm] = useState("FOB");

  // Mercancía
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

  // Ruta
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

  // Conceptos de venta
  const [notas, setNotas] = useState("");
  const [conceptosUSD, setConceptosUSD] = useState<ConceptoVentaCotizacion[]>([emptyUSD()]);
  const [conceptosMXN, setConceptosMXN] = useState<ConceptoVentaCotizacion[]>([emptyMXN()]);

  const clienteSeleccionado = clientes.find(c => c.id === clienteId);
  const esMaritimo = modo === 'Marítimo';
  const esAereo = modo === 'Aéreo';

  const handleCambiarTipoEmbarque = (nuevoTipo: "FCL" | "LCL") => {
    setTipoEmbarque(nuevoTipo);
    setTipoContenedor("");
    setTipoPeso("Peso Normal");
    setDimensionesLCL([{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 }]);
    setTipoCarga("Carga General");
    setMsdsFile(null);
  };

  // Helpers consolidados de conceptos
  const actualizarConcepto = (moneda: "USD" | "MXN", index: number, campo: string, valor: any) => {
    if (campo === '_esOtro') return;
    const setter = moneda === "USD" ? setConceptosUSD : setConceptosMXN;
    setter(prev => {
      const copia = [...prev];
      (copia[index] as any)[campo] = valor;
      if (moneda === "USD" && campo === 'descripcion' && !(CONCEPTOS_CON_IVA_USD as readonly string[]).includes(valor)) {
        copia[index].aplica_iva = false;
      }
      const sub = copia[index].cantidad * copia[index].precio_unitario;
      copia[index].total = moneda === "MXN" ? sub * 1.16 : sub * (copia[index].aplica_iva ? 1.16 : 1);
      return copia;
    });
  };
  const agregarConcepto = (moneda: "USD" | "MXN") => {
    const setter = moneda === "USD" ? setConceptosUSD : setConceptosMXN;
    const factory = moneda === "USD" ? emptyUSD : emptyMXN;
    setter(prev => [...prev, factory()]);
  };
  const eliminarConcepto = (moneda: "USD" | "MXN", index: number) => {
    const setter = moneda === "USD" ? setConceptosUSD : setConceptosMXN;
    const lista = moneda === "USD" ? conceptosUSD : conceptosMXN;
    if (lista.length <= 1) return;
    setter(prev => prev.filter((_, i) => i !== index));
  };

  // Totals
  const totalUSD = conceptosUSD.reduce((s, c) => s + c.total, 0);
  const subtotalMXN = conceptosMXN.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
  const ivaMXN = subtotalMXN * 0.16;
  const totalMXN = subtotalMXN + ivaMXN;

  const totalPiezasLCL = dimensionesLCL.reduce((sum, d) => sum + d.piezas, 0);
  const totalVolumenLCL = dimensionesLCL.reduce((sum, d) => sum + d.volumen_m3, 0);
  const totalPiezasAereas = dimensionesAereas.reduce((sum, d) => sum + d.piezas, 0);
  const totalPesoVolAereo = dimensionesAereas.reduce((sum, d) => sum + d.peso_volumetrico_kg, 0);


  // P&L calculations for summary
  const costosUSD = costosInternos.filter(c => c.moneda === "USD");
  const costosMXN = costosInternos.filter(c => c.moneda === "MXN");
  const plUSD = calcularTotalesPL(costosUSD);
  const plMXN = calcularTotalesPL(costosMXN);

  const buildPaso1Data = () => {
    let msdsArchivo: string | null = null;
    let pesoFinal = pesoKg, volumenFinal = volumenM3, piezasFinal = piezas;
    if (esMaritimo) {
      pesoFinal = 0;
      volumenFinal = tipoEmbarque === 'LCL' ? totalVolumenLCL : 0;
      piezasFinal = tipoEmbarque === 'LCL' ? totalPiezasLCL : 0;
    } else if (esAereo) {
      pesoFinal = totalPesoVolAereo;
      volumenFinal = 0;
      piezasFinal = totalPiezasAereas;
    }
    return {
      es_prospecto: esProspecto,
      cliente_id: esProspecto ? null : clienteId,
      cliente_nombre: esProspecto ? prospectoEmpresa : (clienteSeleccionado?.nombre ?? ''),
      prospecto_empresa: esProspecto ? prospectoEmpresa : '',
      prospecto_contacto: esProspecto ? prospectoContacto : '',
      prospecto_email: esProspecto ? prospectoEmail : '',
      prospecto_telefono: esProspecto ? prospectoTelefono : '',
      modo, tipo, incoterm,
      descripcion_mercancia: sectorEconomico,
      peso_kg: pesoFinal, volumen_m3: volumenFinal, piezas: piezasFinal,
      origen, destino,
      conceptos_venta: [] as ConceptoVentaCotizacion[],
      subtotal: 0,
      moneda: 'USD',
      vigencia_dias: validezPropuesta ? Math.max(1, Math.ceil((validezPropuesta.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 15,
      notas,
      operador: user?.email ?? '',
      tipo_carga: tipoCarga,
      msds_archivo: msdsArchivo,
      tipo_embarque: esMaritimo ? tipoEmbarque : 'FCL',
      tipo_contenedor: esMaritimo && tipoEmbarque === 'FCL' ? tipoContenedor : null,
      tipo_peso: esMaritimo && tipoEmbarque === 'FCL' ? tipoPeso : 'Peso Normal',
      descripcion_adicional: descripcionAdicional,
      sector_economico: sectorEconomico,
      dimensiones_lcl: esMaritimo && tipoEmbarque === 'LCL' ? dimensionesLCL : [],
      dimensiones_aereas: esAereo ? dimensionesAereas : [],
      dias_libres_destino: esMaritimo && tipoEmbarque === 'FCL' ? diasLibresDestino : 0,
      dias_almacenaje: esMaritimo && tipoEmbarque === 'LCL' ? diasAlmacenaje : 0,
      carta_garantia: esMaritimo && tipoEmbarque === 'FCL' ? cartaGarantia : false,
      tiempo_transito_dias: tiempoTransitoDias ?? null,
      frecuencia,
      ruta_texto: rutaTexto,
      validez_propuesta: validezPropuesta ? validezPropuesta.toISOString().split('T')[0] : null,
      tipo_movimiento: tipoMovimiento,
      seguro,
      valor_seguro_usd: seguro ? Number(valorSeguroUsd) || 0 : 0,
      num_contenedores: numContenedores,
    };
  };

  const handleSiguiente = async () => {
    if (currentStep === 1) {
      // Validaciones
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
        // Upload MSDS if needed
        let msdsArchivo: string | null = null;
        if (tipoCarga === 'Mercancía Peligrosa' && msdsFile) {
          const ext = msdsFile.name.split('.').pop() || 'pdf';
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
            id: "",
            cotizacion_id: cotizacionId,
            concepto: f.concepto,
            moneda: f.moneda,
            proveedor: f.proveedor,
            cantidad: f.cantidad,
            costo_unitario: f.costo_unitario,
            costo_total: f.cantidad * f.costo_unitario,
            precio_venta: f.precio_venta,
            unidad_medida: f.unidad_medida,
            created_at: "",
            updated_at: "",
          }));
          await upsertCostos.mutateAsync({ cotizacionId, costos });
        }
        // Pre-llenar Paso 3 directamente
        if (!costosPreLlenados && costosInternos.length > 0) {
          const usdFromCostos = costosInternos
            .filter(c => c.moneda === 'USD' && c.concepto.trim())
            .map(c => {
              const tieneIva = (CONCEPTOS_CON_IVA_USD as readonly string[]).includes(c.concepto);
              return { descripcion: c.concepto, unidad_medida: c.unidad_medida, cantidad: c.cantidad, precio_unitario: c.precio_venta, moneda: 'USD' as const, aplica_iva: tieneIva, total: c.cantidad * c.precio_venta * (tieneIva ? 1.16 : 1) };
            });
          const mxnFromCostos = costosInternos
            .filter(c => c.moneda === 'MXN' && c.concepto.trim())
            .map(c => ({ descripcion: c.concepto, unidad_medida: c.unidad_medida, cantidad: c.cantidad, precio_unitario: c.precio_venta, moneda: 'MXN' as const, aplica_iva: true, total: c.cantidad * c.precio_venta * 1.16 }));
          if (usdFromCostos.length > 0) setConceptosUSD(usdFromCostos);
          if (mxnFromCostos.length > 0) setConceptosMXN(mxnFromCostos);
          setCostosPreLlenados(true);
        }
        setCurrentStep(3);
      } catch (err: any) {
        toast({ title: "Error al guardar costos", description: err.message, variant: "destructive" });
      }
    } else if (currentStep === 3) {
      const conceptosUSDValidos = conceptosUSD.filter(c => c.descripcion && c.descripcion.trim() !== '');
      const conceptosMXNValidos = conceptosMXN.filter(c => c.descripcion && c.descripcion.trim() !== '');

      if (conceptosUSDValidos.length === 0 && conceptosMXNValidos.length === 0) {
        toast({ title: "Agrega al menos un concepto de venta", variant: "destructive" });
        return;
      }

      try {
        if (cotizacionId) {
          await updateCotizacion.mutateAsync({
            id: cotizacionId,
            data: {
              conceptos_venta: [...conceptosUSDValidos, ...conceptosMXNValidos],
              subtotal: totalUSD,
            },
          });
        }
        setCurrentStep(4);
      } catch (err: any) {
        toast({ title: "Error al guardar conceptos de venta", description: err.message, variant: "destructive" });
      }
    }
  };

  const handleGuardar = async () => {
    if (!cotizacionId) return;
    try {
      await updateCotizacion.mutateAsync({
        id: cotizacionId,
        data: { estado: 'Borrador' } as any,
      });
      registrarActividad.mutate({
        accion: 'Crear cotización', modulo: 'Cotizaciones',
        entidad_id: cotizacionId, entidad_nombre: '',
      });
      toast({ title: "Cotización creada exitosamente" });
      navigate(`/cotizaciones/${cotizacionId}`);
    } catch (err: any) {
      toast({ title: "Error al finalizar cotización", description: err.message, variant: "destructive" });
    }
  };


  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header fijo */}
      <div className="flex-none border-b bg-background p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/cotizaciones")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nueva Cotización</h1>
            <p className="text-sm text-muted-foreground">Completa los datos para crear una cotización</p>
          </div>
        </div>
        <StepIndicator steps={WIZARD_STEPS} currentStep={currentStep} />
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* PASO 1 — Datos Generales */}
          {currentStep === 1 && (
            <>
              <SeccionDestinatario
                esProspecto={esProspecto} setEsProspecto={setEsProspecto}
                clienteId={clienteId} setClienteId={setClienteId}
                clientes={clientes}
                prospectoEmpresa={prospectoEmpresa} setProspectoEmpresa={setProspectoEmpresa}
                prospectoContacto={prospectoContacto} setProspectoContacto={setProspectoContacto}
                prospectoEmail={prospectoEmail} setProspectoEmail={setProspectoEmail}
                prospectoTelefono={prospectoTelefono} setProspectoTelefono={setProspectoTelefono}
              />

              <SeccionDatosGeneralesCotizacion
                modo={modo} setModo={setModo}
                tipo={tipo} setTipo={setTipo}
                incoterm={incoterm} setIncoterm={setIncoterm}
              />

              <Card>
                <CardHeader><CardTitle className="text-lg">Mercancía</CardTitle></CardHeader>
                <CardContent>
                  {esMaritimo ? (
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="tipo-embarque" checked={tipoEmbarque === 'FCL'} onChange={() => handleCambiarTipoEmbarque('FCL')} className="accent-primary" />
                          <span className="text-sm font-medium">FCL (Contenedor completo)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="tipo-embarque" checked={tipoEmbarque === 'LCL'} onChange={() => handleCambiarTipoEmbarque('LCL')} className="accent-primary" />
                          <span className="text-sm font-medium">LCL (Carga consolidada)</span>
                        </label>
                      </div>
                      {tipoEmbarque === 'FCL' ? (
                        <SeccionMercanciaMaritimaFCL
                          tipoContenedor={tipoContenedor} setTipoContenedor={setTipoContenedor}
                          tipoCarga={tipoCarga} setTipoCarga={setTipoCarga}
                          sectorEconomico={sectorEconomico} setSectorEconomico={setSectorEconomico}
                          descripcionAdicional={descripcionAdicional} setDescripcionAdicional={setDescripcionAdicional}
                          tipoPeso={tipoPeso} setTipoPeso={setTipoPeso}
                          msdsFile={msdsFile} setMsdsFile={setMsdsFile}
                        />
                      ) : (
                        <SeccionMercanciaMaritimeLCL
                          tipoCarga={tipoCarga} setTipoCarga={setTipoCarga}
                          sectorEconomico={sectorEconomico} setSectorEconomico={setSectorEconomico}
                          descripcionAdicional={descripcionAdicional} setDescripcionAdicional={setDescripcionAdicional}
                          msdsFile={msdsFile} setMsdsFile={setMsdsFile}
                          dimensiones={dimensionesLCL} setDimensiones={setDimensionesLCL}
                        />
                      )}
                    </div>
                  ) : esAereo ? (
                    <SeccionMercanciaAerea
                      tipoCarga={tipoCarga} setTipoCarga={setTipoCarga}
                      sectorEconomico={sectorEconomico} setSectorEconomico={setSectorEconomico}
                      descripcionAdicional={descripcionAdicional} setDescripcionAdicional={setDescripcionAdicional}
                      msdsFile={msdsFile} setMsdsFile={setMsdsFile}
                      dimensiones={dimensionesAereas} setDimensiones={setDimensionesAereas}
                    />
                  ) : (
                    <SeccionMercanciaGeneral
                      tipoCarga={tipoCarga} setTipoCarga={setTipoCarga}
                      sectorEconomico={sectorEconomico} setSectorEconomico={setSectorEconomico}
                      descripcionAdicional={descripcionAdicional} setDescripcionAdicional={setDescripcionAdicional}
                      pesoKg={pesoKg} setPesoKg={setPesoKg}
                      volumenM3={volumenM3} setVolumenM3={setVolumenM3}
                      piezas={piezas} setPiezas={setPiezas}
                      msdsFile={msdsFile} setMsdsFile={setMsdsFile}
                    />
                  )}
                </CardContent>
              </Card>

              <SeccionRutaCotizacion
                modo={modo} tipoEmbarque={tipoEmbarque}
                origen={origen} setOrigen={setOrigen}
                destino={destino} setDestino={setDestino}
                tiempoTransitoDias={tiempoTransitoDias} setTiempoTransitoDias={setTiempoTransitoDias}
                diasLibresDestino={diasLibresDestino} setDiasLibresDestino={setDiasLibresDestino}
                diasAlmacenaje={diasAlmacenaje} setDiasAlmacenaje={setDiasAlmacenaje}
                cartaGarantia={cartaGarantia} setCartaGarantia={setCartaGarantia}
                frecuencia={frecuencia} setFrecuencia={setFrecuencia}
                rutaTexto={rutaTexto} setRutaTexto={setRutaTexto}
                validezPropuesta={validezPropuesta} setValidezPropuesta={setValidezPropuesta}
                tipoMovimiento={tipoMovimiento} setTipoMovimiento={setTipoMovimiento}
                seguro={seguro} setSeguro={setSeguro}
                valorSeguroUsd={valorSeguroUsd} setValorSeguroUsd={setValorSeguroUsd}
              />

              {/* Número de Embarques */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Número de Embarques
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Label>¿Cuántos contenedores o BLs tiene esta operación?</Label>
                  <Input
                    type="number"
                    min={1}
                    value={numContenedores}
                    onChange={e => setNumContenedores(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-32 mt-1"
                  />
                </CardContent>
              </Card>

              {/* Notas */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Notas Adicionales</CardTitle></CardHeader>
                <CardContent>
                  <Label>Notas</Label>
                  <Textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones o condiciones..." rows={3} />
                </CardContent>
              </Card>
            </>
          )}

          {/* PASO 2 — Costos & P&L */}
          {currentStep === 2 && (
            <SeccionCostosInternosPLLocal filas={costosInternos} setFilas={setCostosInternos} />
          )}

          {/* PASO 3 — Cotización Cliente */}
          {currentStep === 3 && (
            <>
              {costosPreLlenados && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-sm">
                  <Info className="h-4 w-4 flex-shrink-0" />
                  Pre-llenado desde Costos & P&L. Puedes ajustar si es necesario.
                </div>
              )}
              <SeccionConceptosVentaCotizacion
                conceptosUSD={conceptosUSD}
                conceptosMXN={conceptosMXN}
                actualizarConceptoUSD={(i, c, v) => actualizarConcepto("USD", i, c, v)}
                actualizarConceptoMXN={(i, c, v) => actualizarConcepto("MXN", i, c, v)}
                agregarConceptoUSD={() => agregarConcepto("USD")}
                agregarConceptoMXN={() => agregarConcepto("MXN")}
                eliminarConceptoUSD={(i) => eliminarConcepto("USD", i)}
                eliminarConceptoMXN={(i) => eliminarConcepto("MXN", i)}
                totalUSD={totalUSD}
                subtotalMXN={subtotalMXN}
                ivaMXN={ivaMXN}
                totalMXN={totalMXN}
              />
            </>
          )}

          {/* PASO 4 — Resumen */}
          {currentStep === 4 && (
            <PasoResumenCotizacion
              plUSD={plUSD}
              plMXN={plMXN}
              tieneCostosUSD={costosUSD.length > 0}
              tieneCostosMXN={costosMXN.length > 0}
              nombreCliente={esProspecto ? prospectoEmpresa : (clienteSeleccionado?.nombre || '—')}
              origen={origen}
              destino={destino}
              numContenedores={numContenedores}
              modo={modo}
              incoterm={incoterm}
              tipo={tipo}
              totalUSD={totalUSD}
              totalMXN={totalMXN}
            />
          )}
        </div>
      </div>

      {/* Footer fijo */}
      <div className="flex-none border-t bg-background p-4">
        <div className="max-w-4xl mx-auto flex justify-between">
          <Button
            variant="outline"
            onClick={() => currentStep > 1 ? setCurrentStep(p => p - 1) : navigate("/cotizaciones")}
          >
            {currentStep === 1 ? (
              'Cancelar'
            ) : (
              <><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</>
            )}
          </Button>
          <Button
            disabled={crearCotizacion.isPending || updateCotizacion.isPending || upsertCostos.isPending}
            onClick={() => {
              if (currentStep < 4) handleSiguiente();
              else handleGuardar();
            }}
          >
            {currentStep === 4 ? (
              updateCotizacion.isPending ? 'Guardando...' : (
                <><Save className="h-4 w-4 mr-1" /> Guardar Cotización</>
              )
            ) : (
              crearCotizacion.isPending || updateCotizacion.isPending || upsertCostos.isPending ? 'Guardando...' : (
                <>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></>
              )
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
