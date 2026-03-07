import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useClientesForSelect } from "@/hooks/useClientes";
import { useCreateCotizacion, useUpdateCotizacion } from "@/hooks/useCotizaciones";
import { useUpsertCotizacionCostos } from "@/hooks/useCotizacionCostos";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Save, ChevronRight, ChevronLeft, Info, Package } from "lucide-react";

import { StepIndicator } from "@/components/embarque/StepIndicator";
import SeccionDestinatario from "@/components/cotizacion/SeccionDestinatario";
import SeccionDatosGeneralesCotizacion from "@/components/cotizacion/SeccionDatosGeneralesCotizacion";
import SeccionRutaCotizacion from "@/components/cotizacion/SeccionRutaCotizacion";
import SeccionConceptosVentaCotizacion from "@/components/cotizacion/SeccionConceptosVentaCotizacion";
import SeccionMercanciaMaritimaFCL from "@/components/cotizacion/SeccionMercanciaMaritimaFCL";
import SeccionMercanciaMaritimeLCL from "@/components/cotizacion/SeccionMercanciaMaritimeLCL";
import SeccionMercanciaGeneral from "@/components/cotizacion/SeccionMercanciaGeneral";
import SeccionMercanciaAerea from "@/components/cotizacion/SeccionMercanciaAerea";
import SeccionCostosInternosPLUnificado from "@/components/cotizacion/SeccionCostosInternosPLUnificado";
import PasoResumenCotizacion from "@/components/cotizacion/PasoResumenCotizacion";
import { useCotizacionWizardForm } from "@/hooks/useCotizacionWizardForm";

const WIZARD_STEPS = [
  { num: 1, title: "Datos Generales" },
  { num: 2, title: "Costos & P&L" },
  { num: 3, title: "Cotización Cliente" },
  { num: 4, title: "Resumen" },
];

export default function NuevaCotizacion() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: clientes = [] } = useClientesForSelect();

  const w = useCotizacionWizardForm({
    navigate,
    toast,
    userEmail: user?.email ?? "",
    clientes,
    mutations: {
      crearCotizacion: useCreateCotizacion(),
      updateCotizacion: useUpdateCotizacion(),
      upsertCostos: useUpsertCotizacionCostos(),
      registrarActividad: useRegistrarActividad(),
    },
  });

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
        <StepIndicator steps={WIZARD_STEPS} currentStep={w.currentStep} />
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* PASO 1 — Datos Generales */}
          {w.currentStep === 1 && (
            <>
              <SeccionDestinatario
                esProspecto={w.esProspecto} setEsProspecto={w.setEsProspecto}
                clienteId={w.clienteId} setClienteId={w.setClienteId}
                clientes={clientes}
                prospectoEmpresa={w.prospectoEmpresa} setProspectoEmpresa={w.setProspectoEmpresa}
                prospectoContacto={w.prospectoContacto} setProspectoContacto={w.setProspectoContacto}
                prospectoEmail={w.prospectoEmail} setProspectoEmail={w.setProspectoEmail}
                prospectoTelefono={w.prospectoTelefono} setProspectoTelefono={w.setProspectoTelefono}
              />

              <SeccionDatosGeneralesCotizacion
                modo={w.modo} setModo={w.setModo}
                tipo={w.tipo} setTipo={w.setTipo}
                incoterm={w.incoterm} setIncoterm={w.setIncoterm}
              />

              <Card>
                <CardHeader><CardTitle className="text-lg">Mercancía</CardTitle></CardHeader>
                <CardContent>
                  {w.esMaritimo ? (
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="tipo-embarque" checked={w.tipoEmbarque === "FCL"} onChange={() => w.handleCambiarTipoEmbarque("FCL")} className="accent-primary" />
                          <span className="text-sm font-medium">FCL (Contenedor completo)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="tipo-embarque" checked={w.tipoEmbarque === "LCL"} onChange={() => w.handleCambiarTipoEmbarque("LCL")} className="accent-primary" />
                          <span className="text-sm font-medium">LCL (Carga consolidada)</span>
                        </label>
                      </div>
                      {w.tipoEmbarque === "FCL" ? (
                        <SeccionMercanciaMaritimaFCL
                          tipoContenedor={w.tipoContenedor} setTipoContenedor={w.setTipoContenedor}
                          tipoCarga={w.tipoCarga} setTipoCarga={w.setTipoCarga}
                          sectorEconomico={w.sectorEconomico} setSectorEconomico={w.setSectorEconomico}
                          descripcionAdicional={w.descripcionAdicional} setDescripcionAdicional={w.setDescripcionAdicional}
                          tipoPeso={w.tipoPeso} setTipoPeso={w.setTipoPeso}
                          msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile}
                        />
                      ) : (
                        <SeccionMercanciaMaritimeLCL
                          tipoCarga={w.tipoCarga} setTipoCarga={w.setTipoCarga}
                          sectorEconomico={w.sectorEconomico} setSectorEconomico={w.setSectorEconomico}
                          descripcionAdicional={w.descripcionAdicional} setDescripcionAdicional={w.setDescripcionAdicional}
                          msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile}
                          dimensiones={w.dimensionesLCL} setDimensiones={w.setDimensionesLCL}
                        />
                      )}
                    </div>
                  ) : w.esAereo ? (
                    <SeccionMercanciaAerea
                      tipoCarga={w.tipoCarga} setTipoCarga={w.setTipoCarga}
                      sectorEconomico={w.sectorEconomico} setSectorEconomico={w.setSectorEconomico}
                      descripcionAdicional={w.descripcionAdicional} setDescripcionAdicional={w.setDescripcionAdicional}
                      msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile}
                      dimensiones={w.dimensionesAereas} setDimensiones={w.setDimensionesAereas}
                    />
                  ) : (
                    <SeccionMercanciaGeneral
                      tipoCarga={w.tipoCarga} setTipoCarga={w.setTipoCarga}
                      sectorEconomico={w.sectorEconomico} setSectorEconomico={w.setSectorEconomico}
                      descripcionAdicional={w.descripcionAdicional} setDescripcionAdicional={w.setDescripcionAdicional}
                      pesoKg={w.pesoKg} setPesoKg={w.setPesoKg}
                      volumenM3={w.volumenM3} setVolumenM3={w.setVolumenM3}
                      piezas={w.piezas} setPiezas={w.setPiezas}
                      msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile}
                    />
                  )}
                </CardContent>
              </Card>

              <SeccionRutaCotizacion
                modo={w.modo} tipoEmbarque={w.tipoEmbarque}
                origen={w.origen} setOrigen={w.setOrigen}
                destino={w.destino} setDestino={w.setDestino}
                tiempoTransitoDias={w.tiempoTransitoDias} setTiempoTransitoDias={w.setTiempoTransitoDias}
                diasLibresDestino={w.diasLibresDestino} setDiasLibresDestino={w.setDiasLibresDestino}
                diasAlmacenaje={w.diasAlmacenaje} setDiasAlmacenaje={w.setDiasAlmacenaje}
                cartaGarantia={w.cartaGarantia} setCartaGarantia={w.setCartaGarantia}
                frecuencia={w.frecuencia} setFrecuencia={w.setFrecuencia}
                rutaTexto={w.rutaTexto} setRutaTexto={w.setRutaTexto}
                validezPropuesta={w.validezPropuesta} setValidezPropuesta={w.setValidezPropuesta}
                tipoMovimiento={w.tipoMovimiento} setTipoMovimiento={w.setTipoMovimiento}
                seguro={w.seguro} setSeguro={w.setSeguro}
                valorSeguroUsd={w.valorSeguroUsd} setValorSeguroUsd={w.setValorSeguroUsd}
              />

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
                    type="number" min={1}
                    value={w.numContenedores}
                    onChange={e => w.setNumContenedores(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-32 mt-1"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Notas Adicionales</CardTitle></CardHeader>
                <CardContent>
                  <Label>Notas</Label>
                  <Textarea value={w.notas} onChange={e => w.setNotas(e.target.value)} placeholder="Observaciones o condiciones..." rows={3} />
                </CardContent>
              </Card>
            </>
          )}

          {/* PASO 2 — Costos & P&L */}
          {w.currentStep === 2 && (
            <SeccionCostosInternosPLUnificado tipo="local" filas={w.costosInternos} setFilas={w.setCostosInternos} />
          )}

          {/* PASO 3 — Cotización Cliente */}
          {w.currentStep === 3 && (
            <>
              {w.costosPreLlenados && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-sm">
                  <Info className="h-4 w-4 flex-shrink-0" />
                  Pre-llenado desde Costos & P&L. Puedes ajustar si es necesario.
                </div>
              )}
              <SeccionConceptosVentaCotizacion
                conceptosUSD={w.conceptosUSD}
                conceptosMXN={w.conceptosMXN}
                actualizarConceptoUSD={(i, c, v) => w.actualizarConcepto("USD", i, c, v)}
                actualizarConceptoMXN={(i, c, v) => w.actualizarConcepto("MXN", i, c, v)}
                agregarConceptoUSD={() => w.agregarConcepto("USD")}
                agregarConceptoMXN={() => w.agregarConcepto("MXN")}
                eliminarConceptoUSD={(i) => w.eliminarConcepto("USD", i)}
                eliminarConceptoMXN={(i) => w.eliminarConcepto("MXN", i)}
                totalUSD={w.totalUSD}
                subtotalMXN={w.subtotalMXN}
                ivaMXN={w.ivaMXN}
                totalMXN={w.totalMXN}
              />
            </>
          )}

          {/* PASO 4 — Resumen */}
          {w.currentStep === 4 && (
            <PasoResumenCotizacion
              plUSD={w.plUSD} plMXN={w.plMXN}
              tieneCostosUSD={w.costosUSD.length > 0}
              tieneCostosMXN={w.costosMXN.length > 0}
              nombreCliente={w.esProspecto ? w.prospectoEmpresa : (w.clienteSeleccionado?.nombre || "—")}
              origen={w.origen} destino={w.destino}
              numContenedores={w.numContenedores} modo={w.modo}
              incoterm={w.incoterm} tipo={w.tipo}
              totalUSD={w.totalUSD} totalMXN={w.totalMXN}
            />
          )}
        </div>
      </div>

      {/* Footer fijo */}
      <div className="flex-none border-t bg-background p-4">
        <div className="max-w-4xl mx-auto flex justify-between">
          <Button variant="outline" onClick={w.handleBack}>
            {w.currentStep === 1 ? "Cancelar" : <><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</>}
          </Button>
          <Button
            disabled={w.isPending}
            onClick={() => { if (w.currentStep < 4) w.handleSiguiente(); else w.handleGuardar(); }}
          >
            {w.currentStep === 4
              ? (w.isPending ? "Guardando..." : <><Save className="h-4 w-4 mr-1" /> Guardar Cotización</>)
              : (w.isPending ? "Guardando..." : <>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></>)
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
