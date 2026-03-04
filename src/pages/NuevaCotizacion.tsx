import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useClientesForSelect } from "@/hooks/useClientes";
import { useCreateCotizacion, ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from "@/hooks/useCotizaciones";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFile } from "@/lib/storage";
import { ArrowLeft, Save } from "lucide-react";

import SeccionDestinatario from "@/components/cotizacion/SeccionDestinatario";
import SeccionDatosGeneralesCotizacion from "@/components/cotizacion/SeccionDatosGeneralesCotizacion";
import SeccionRutaCotizacion from "@/components/cotizacion/SeccionRutaCotizacion";
import SeccionConceptosVentaCotizacion from "@/components/cotizacion/SeccionConceptosVentaCotizacion";
import SeccionMercanciaMaritimaFCL from "@/components/cotizacion/SeccionMercanciaMaritimaFCL";
import SeccionMercanciaMaritimeLCL from "@/components/cotizacion/SeccionMercanciaMaritimeLCL";
import SeccionMercanciaGeneral from "@/components/cotizacion/SeccionMercanciaGeneral";
import SeccionMercanciaAerea from "@/components/cotizacion/SeccionMercanciaAerea";

const emptyUSD = (): ConceptoVentaCotizacion => ({
  descripcion: '', cantidad: 1, precio_unitario: 0, moneda: 'USD', total: 0, aplica_iva: false,
});
const emptyMXN = (): ConceptoVentaCotizacion => ({
  descripcion: '', cantidad: 1, precio_unitario: 0, moneda: 'MXN', total: 0, aplica_iva: true,
});

export default function NuevaCotizacion() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: clientes = [] } = useClientesForSelect();
  const crearCotizacion = useCreateCotizacion();
  const registrarActividad = useRegistrarActividad();

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

  // Conceptos separados por moneda
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
    if (campo === '_esOtro') return; // flag internal
    setConceptosUSD(prev => {
      const copia = [...prev];
      (copia[index] as any)[campo] = valor;
      copia[index].total = copia[index].cantidad * copia[index].precio_unitario;
      return copia;
    });
  };
  const agregarConceptoUSD = () => setConceptosUSD(prev => [...prev, emptyUSD()]);
  const eliminarConceptoUSD = (index: number) => {
    if (conceptosUSD.length <= 1) return;
    setConceptosUSD(prev => prev.filter((_, i) => i !== index));
  };

  // MXN helpers (total includes IVA)
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

  const handleGuardar = async () => {
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
    const allConceptos = [...conceptosUSD, ...conceptosMXN];
    if (allConceptos.some(c => !c.descripcion.trim())) {
      toast({ title: "Completa todos los conceptos de venta", variant: "destructive" });
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
      });

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cotizaciones")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nueva Cotización</h1>
          <p className="text-sm text-muted-foreground">Completa los datos para crear una cotización</p>
        </div>
      </div>

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

      {/* Mercancía */}
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

      <Card>
        <CardHeader><CardTitle className="text-lg">Notas Adicionales</CardTitle></CardHeader>
        <CardContent>
          <Label>Notas</Label>
          <Textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones o condiciones..." rows={3} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/cotizaciones")}>Cancelar</Button>
        <Button onClick={handleGuardar} disabled={crearCotizacion.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {crearCotizacion.isPending ? 'Guardando...' : 'Guardar Cotización'}
        </Button>
      </div>
    </div>
  );
}
