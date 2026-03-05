import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useClientesForSelect } from "@/hooks/useClientes";
import { useCreateCotizacion, ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from "@/hooks/useCotizaciones";
import { useUpsertCotizacionCostos, CostoCotizacion } from "@/hooks/useCotizacionCostos";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFile } from "@/lib/storage";
import { formatCurrency } from "@/lib/formatters";
import { ArrowLeft, Save, ChevronRight, ChevronLeft, Info, Package } from "lucide-react";

import { StepIndicator } from "@/components/embarque/StepIndicator";
import SeccionDestinatario from "@/components/cotizacion/SeccionDestinatario";
import SeccionDatosGeneralesCotizacion from "@/components/cotizacion/SeccionDatosGeneralesCotizacion";
import SeccionRutaCotizacion from "@/components/cotizacion/SeccionRutaCotizacion";
import SeccionConceptosVentaCotizacion, { CONCEPTOS_CON_IVA } from "@/components/cotizacion/SeccionConceptosVentaCotizacion";
import SeccionMercanciaMaritimaFCL from "@/components/cotizacion/SeccionMercanciaMaritimaFCL";
import SeccionMercanciaMaritimeLCL from "@/components/cotizacion/SeccionMercanciaMaritimeLCL";
import SeccionMercanciaGeneral from "@/components/cotizacion/SeccionMercanciaGeneral";
import SeccionMercanciaAerea from "@/components/cotizacion/SeccionMercanciaAerea";
import SeccionCostosInternosPLLocal, { type FilaCostoLocal } from "@/components/cotizacion/SeccionCostosInternosPLLocal";

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
  const upsertCostos = useUpsertCotizacionCostos();
  const registrarActividad = useRegistrarActividad();

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

  // USD helpers
  const actualizarConceptoUSD = (index: number, campo: string, valor: any) => {
    if (campo === '_esOtro') return;
    setConceptosUSD(prev => {
      const copia = [...prev];
      (copia[index] as any)[campo] = valor;
      if (campo === 'descripcion') {
        if (!CONCEPTOS_CON_IVA.includes(valor)) {
          copia[index].aplica_iva = false;
        }
      }
      copia[index].total = copia[index].cantidad * copia[index].precio_unitario * (copia[index].aplica_iva ? 1.16 : 1);
      return copia;
    });
  };
  const agregarConceptoUSD = () => setConceptosUSD(prev => [...prev, emptyUSD()]);
  const eliminarConceptoUSD = (index: number) => {
    if (conceptosUSD.length <= 1) return;
    setConceptosUSD(prev => prev.filter((_, i) => i !== index));
  };

  // MXN helpers
  const actualizarConceptoMXN = (index: number, campo: string, valor: any) => {
    if (campo === '_esOtro') return;
    setConceptosMXN(prev => {
      const copia = [...prev];
      (copia[index] as any)[campo] = valor;
      const sub = copia[index].cantidad * copia[index].precio_unitario;
      copia[index].total = sub * 1.16;
      return copia;
    });
  };
  const agregarConceptoMXN = () => setConceptosMXN(prev => [...prev, emptyMXN()]);
  const eliminarConceptoMXN = (index: number) => {
    if (conceptosMXN.length <= 1) return;
    setConceptosMXN(prev => prev.filter((_, i) => i !== index));
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

  // Pre-fill step 3 from step 2 costs
  useEffect(() => {
    if (currentStep === 3 && !costosPreLlenados && costosInternos.length > 0) {
      const usdFromCostos = costosInternos
        .filter(c => c.moneda === "USD" && c.concepto.trim())
        .map(c => ({
          descripcion: c.concepto,
          unidad_medida: c.unidad_medida,
          cantidad: c.cantidad,
          precio_unitario: c.precio_venta,
          moneda: 'USD' as const,
          total: c.cantidad * c.precio_venta * (c.aplica_iva ? 1.16 : 1),
          aplica_iva: c.aplica_iva ?? false,
        }));
      const mxnFromCostos = costosInternos
        .filter(c => c.moneda === "MXN" && c.concepto.trim())
        .map(c => ({
          descripcion: c.concepto,
          unidad_medida: c.unidad_medida,
          cantidad: c.cantidad,
          precio_unitario: c.precio_venta,
          moneda: 'MXN' as const,
          total: c.cantidad * c.precio_venta * 1.16,
          aplica_iva: c.aplica_iva ?? true,
        }));

      if (usdFromCostos.length > 0) setConceptosUSD(usdFromCostos);
      if (mxnFromCostos.length > 0) setConceptosMXN(mxnFromCostos);
      setCostosPreLlenados(true);
    }
  }, [currentStep, costosPreLlenados, costosInternos]);

  // P&L calculations for summary
  const costosUSD = costosInternos.filter(c => c.moneda === "USD");
  const costosMXN = costosInternos.filter(c => c.moneda === "MXN");
  const calcPL = (rows: FilaCostoLocal[]) => {
    const totalCosto = rows.reduce((s, f) => s + f.cantidad * f.costo_unitario, 0);
    const totalVenta = rows.reduce((s, f) => s + f.cantidad * f.precio_venta, 0);
    const profit = totalVenta - totalCosto;
    const pct = totalVenta !== 0 ? (profit / totalVenta) * 100 : 0;
    return { totalCosto, totalVenta, profit, pct };
  };
  const plUSD = calcPL(costosUSD);
  const plMXN = calcPL(costosMXN);

  const handleGuardar = async () => {
    if (!esProspecto && !clienteId) {
      toast({ title: "Selecciona un cliente", variant: "destructive" });
      setCurrentStep(1);
      return;
    }
    if (esProspecto && !prospectoEmpresa.trim()) {
      toast({ title: "Ingresa el nombre de la empresa del prospecto", variant: "destructive" });
      setCurrentStep(1);
      return;
    }
    if (esProspecto && !prospectoContacto.trim()) {
      toast({ title: "Ingresa el nombre del contacto del prospecto", variant: "destructive" });
      setCurrentStep(1);
      return;
    }
    const allConceptos = [...conceptosUSD, ...conceptosMXN];
    if (allConceptos.some(c => !c.descripcion.trim())) {
      toast({ title: "Completa todos los conceptos de venta", variant: "destructive" });
      setCurrentStep(3);
      return;
    }

    try {
      let msdsArchivo: string | null = null;
      if (tipoCarga === 'Mercancía Peligrosa' && msdsFile) {
        const ext = msdsFile.name.split('.').pop() || 'pdf';
        const path = `cotizaciones/msds-${Date.now()}.${ext}`;
        await uploadFile(path, msdsFile);
        msdsArchivo = path;
      }

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

      const cotizacion = await crearCotizacion.mutateAsync({
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
        conceptos_venta: allConceptos,
        subtotal: totalUSD,
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
      });

      // Save internal costs
      if (costosInternos.length > 0) {
        const costos: CostoCotizacion[] = costosInternos.map(f => ({
          id: "",
          cotizacion_id: cotizacion.id,
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
        await upsertCostos.mutateAsync({ cotizacionId: cotizacion.id, costos });
      }

      registrarActividad.mutate({
        accion: 'Crear cotización', modulo: 'Cotizaciones',
        entidad_id: cotizacion.id, entidad_nombre: cotizacion.folio,
      });
      toast({ title: `Cotización ${cotizacion.folio} creada` });
      navigate(`/cotizaciones/${cotizacion.id}`);
    } catch (err: any) {
      toast({ title: "Error al crear cotización", description: err.message, variant: "destructive" });
    }
  };

  const profitBadgeLocal = (pct: number) => {
    if (pct > 15) return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{pct.toFixed(1)}%</Badge>;
    if (pct > 0) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{pct.toFixed(1)}%</Badge>;
    if (pct < 0) return <Badge className="bg-red-100 text-red-700 border-red-200">{pct.toFixed(1)}%</Badge>;
    return <Badge variant="secondary">0%</Badge>;
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
                actualizarConceptoUSD={actualizarConceptoUSD}
                actualizarConceptoMXN={actualizarConceptoMXN}
                agregarConceptoUSD={agregarConceptoUSD}
                agregarConceptoMXN={agregarConceptoMXN}
                eliminarConceptoUSD={eliminarConceptoUSD}
                eliminarConceptoMXN={eliminarConceptoMXN}
                totalUSD={totalUSD}
                subtotalMXN={subtotalMXN}
                ivaMXN={ivaMXN}
                totalMXN={totalMXN}
              />
            </>
          )}

          {/* PASO 4 — Resumen */}
          {currentStep === 4 && (
            <div className="space-y-4">
              {/* P&L Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {costosUSD.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">P&L USD</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Costo</span>
                        <span>{formatCurrency(plUSD.totalCosto, "USD")}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Venta</span>
                        <span>{formatCurrency(plUSD.totalVenta, "USD")}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Profit</span>
                        <span className={plUSD.profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                          {formatCurrency(plUSD.profit, "USD")}
                        </span>
                      </div>
                      <div className="flex justify-center pt-1">{profitBadgeLocal(plUSD.pct)}</div>
                    </CardContent>
                  </Card>
                )}
                {costosMXN.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">P&L MXN</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Costo</span>
                        <span>{formatCurrency(plMXN.totalCosto, "MXN")}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Venta</span>
                        <span>{formatCurrency(plMXN.totalVenta, "MXN")}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Profit</span>
                        <span className={plMXN.profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                          {formatCurrency(plMXN.profit, "MXN")}
                        </span>
                      </div>
                      <div className="flex justify-center pt-1">{profitBadgeLocal(plMXN.pct)}</div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Datos de operación */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Datos de la Operación</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Cliente</span>
                      <p className="font-medium">{esProspecto ? prospectoEmpresa : (clienteSeleccionado?.nombre || '—')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ruta</span>
                      <p className="font-medium">{origen || '—'} → {destino || '—'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contenedores/BLs</span>
                      <p className="font-medium">{numContenedores}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Modo</span>
                      <p className="font-medium">{modo}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Incoterm</span>
                      <p className="font-medium">{incoterm}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo</span>
                      <p className="font-medium">{tipo}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Totales de venta */}
              <div className="flex flex-col items-end gap-1 p-4 border rounded-md bg-muted/30">
                <span className="text-base font-bold">Total USD: {formatCurrency(totalUSD, 'USD')}</span>
                <span className="text-base font-bold">Total MXN (c/IVA): {formatCurrency(totalMXN, 'MXN')}</span>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <Info className="h-4 w-4 flex-shrink-0" />
                La cotización se guardará en estado Borrador.
              </div>
            </div>
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
            disabled={crearCotizacion.isPending || upsertCostos.isPending}
            onClick={() => {
              if (currentStep < 4) setCurrentStep(p => p + 1);
              else handleGuardar();
            }}
          >
            {currentStep === 4 ? (
              crearCotizacion.isPending || upsertCostos.isPending ? 'Guardando...' : (
                <><Save className="h-4 w-4 mr-1" /> Guardar Cotización</>
              )
            ) : (
              <>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
