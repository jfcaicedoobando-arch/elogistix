import { useParams, useNavigate, Navigate } from "react-router-dom";
import { FormProvider } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useClientesForSelect } from "@/hooks/useClientes";
import { useCotizacion, useUpdateCotizacion, useCreateCotizacion } from "@/hooks/useCotizaciones";
import { useCotizacionCostos, useUpsertCotizacionCostos } from "@/hooks/useCotizacionCostos";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
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

export default function EditarCotizacion() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const { data: clientes = [] } = useClientesForSelect();
  const { data: cotizacion, isLoading } = useCotizacion(id);
  const { data: costos, isLoading: costosLoading } = useCotizacionCostos(id);

  if (isLoading || costosLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!cotizacion || !canEdit || cotizacion.estado !== "Borrador") {
    return <Navigate to={`/cotizaciones/${id}`} replace />;
  }

  return (
    <EditarCotizacionForm
      cotizacion={cotizacion}
      costos={costos ?? []}
      clientes={clientes}
      navigate={navigate}
      toast={toast}
      userEmail={user?.email ?? ""}
    />
  );
}

function EditarCotizacionForm({
  cotizacion,
  costos,
  clientes,
  navigate,
  toast,
  userEmail,
}: {
  cotizacion: any;
  costos: any[];
  clientes: { id: string; nombre: string }[];
  navigate: any;
  toast: any;
  userEmail: string;
}) {
  const w = useCotizacionWizardForm({
    navigate,
    toast,
    userEmail,
    clientes,
    mutations: {
      crearCotizacion: useCreateCotizacion(),
      updateCotizacion: useUpdateCotizacion(),
      upsertCostos: useUpsertCotizacionCostos(),
      registrarActividad: useRegistrarActividad(),
    },
    initialData: cotizacion,
    initialCostos: costos,
  });

  const { form } = w;
  const tipoEmbarque = form.watch("tipoEmbarque");

  return (
    <FormProvider {...form}>
      <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
        <div className="flex-none border-b bg-background p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/cotizaciones/${cotizacion.id}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Editar Cotización</h1>
              <p className="text-sm text-muted-foreground">{cotizacion.folio}</p>
            </div>
          </div>
          <StepIndicator steps={WIZARD_STEPS} currentStep={w.currentStep} />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {w.currentStep === 1 && (
              <>
                <SeccionDestinatario clientes={clientes} />
                <SeccionDatosGeneralesCotizacion />
                <Card>
                  <CardHeader><CardTitle className="text-lg">Mercancía</CardTitle></CardHeader>
                  <CardContent>
                    {w.esMaritimo ? (
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="tipo-embarque" checked={tipoEmbarque === "FCL"} onChange={() => w.handleCambiarTipoEmbarque("FCL")} className="accent-primary" />
                            <span className="text-sm font-medium">FCL (Contenedor completo)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="tipo-embarque" checked={tipoEmbarque === "LCL"} onChange={() => w.handleCambiarTipoEmbarque("LCL")} className="accent-primary" />
                            <span className="text-sm font-medium">LCL (Carga consolidada)</span>
                          </label>
                        </div>
                        {tipoEmbarque === "FCL" ? (
                          <SeccionMercanciaMaritimaFCL msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
                        ) : (
                          <SeccionMercanciaMaritimeLCL msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
                        )}
                      </div>
                    ) : w.esAereo ? (
                      <SeccionMercanciaAerea msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
                    ) : (
                      <SeccionMercanciaGeneral msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
                    )}
                  </CardContent>
                </Card>
                <SeccionRutaCotizacion />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      Número de Embarques
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Label>Número de contenedores</Label>
                    <Input
                      type="number" min={1}
                      value={form.watch("numContenedores")}
                      onChange={e => form.setValue("numContenedores", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-32 mt-1"
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-lg">Notas Adicionales</CardTitle></CardHeader>
                  <CardContent>
                    <Label>Notas</Label>
                    <Textarea value={form.watch("notas")} onChange={e => form.setValue("notas", e.target.value)} placeholder="Observaciones o condiciones..." rows={3} />
                  </CardContent>
                </Card>
              </>
            )}

            {w.currentStep === 2 && (
              <SeccionCostosInternosPLUnificado tipo="local" filas={w.costosInternos} setFilas={w.setCostosInternos} />
            )}

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

            {w.currentStep === 4 && (
              <PasoResumenCotizacion
                plUSD={w.plUSD} plMXN={w.plMXN}
                tieneCostosUSD={w.costosUSD.length > 0}
                tieneCostosMXN={w.costosMXN.length > 0}
                nombreCliente={form.watch("esProspecto") ? form.watch("prospectoEmpresa") : (w.clienteSeleccionado?.nombre || "—")}
                origen={form.watch("origen")} destino={form.watch("destino")}
                numContenedores={form.watch("numContenedores")} modo={form.watch("modo")}
                incoterm={form.watch("incoterm")} tipo={form.watch("tipo")}
                totalUSD={w.totalUSD} totalMXN={w.totalMXN}
              />
            )}
          </div>
        </div>

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
                ? (w.isPending ? "Guardando..." : <><Save className="h-4 w-4 mr-1" /> Guardar Cambios</>)
                : (w.isPending ? "Guardando..." : <>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></>)
              }
            </Button>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
