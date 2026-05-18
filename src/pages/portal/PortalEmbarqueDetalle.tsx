import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { formatDate, getOrigen, getDestino } from "@/lib/formatters";
import { PortalEmbarqueTimeline } from "@/components/portal/PortalEmbarqueTimeline";
import { PortalEmbarqueDocumentos } from "@/components/portal/PortalEmbarqueDocumentos";
import { PortalEmbarqueResumenTab } from "@/components/portal/embarqueDetalle/PortalEmbarqueResumenTab";
import { TrackingLiveCard } from "@/components/embarque/TrackingLiveCard";
import { usePortalEmbarqueDetalleController } from "@/hooks/embarque";
import { useRegisterBreadcrumbLabel } from "@/contexts/BreadcrumbContext";

export default function PortalEmbarqueDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    embarque,
    isLoading,
    eventos,
    documentos,
    estadoVisual,
    currentStepIndex,
    diasParaEta,
    docsValidados,
    docsTotal,
    progressSteps,
  } = usePortalEmbarqueDetalleController(id);
  useRegisterBreadcrumbLabel(id, embarque?.expediente);

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!embarque) {
    return (
      <div className="text-center py-20">
        <Ship className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground font-medium">Embarque no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/portal/embarques")}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/portal/embarques")} className="mt-0.5" aria-label="Volver a mis embarques">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{embarque.expediente}</h1>
            <Badge className={getEstadoColor(estadoVisual ?? "")}>{estadoVisual}</Badge>
            <ModoIcon modo={embarque.modo} size={18} circle />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {embarque.tipo} • {embarque.modo} • {embarque.incoterm}
          </p>
        </div>
      </div>

      {/* Progress Tracker */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
            <div
              className="absolute top-5 left-0 h-0.5 bg-accent transition-all duration-500"
              style={{ width: `${Math.min(100, (currentStepIndex / (progressSteps.length - 1)) * 100)}%` }}
            />

            {progressSteps.map((step, i) => {
              const isCompleted = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step.key} className="flex flex-col items-center relative z-10 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border-2 transition-all ${
                      isCompleted
                        ? "bg-accent border-accent text-white"
                        : isCurrent
                        ? "bg-accent/10 border-accent text-accent ring-4 ring-accent/20"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {step.icon}
                  </div>
                  <span className={`text-[10px] mt-2 text-center font-medium ${
                    isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ETA countdown */}
          {diasParaEta !== null && diasParaEta > 0 && (
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Llegada estimada en <span className="font-bold text-accent">{diasParaEta} día{diasParaEta !== 1 ? "s" : ""}</span>
                {embarque.eta && (
                  <span> ({formatDate(embarque.eta, "dd 'de' MMMM")})</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground font-medium">Origen</p>
            <p className="text-xs font-semibold mt-0.5 truncate">{getOrigen(embarque)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground font-medium">Destino</p>
            <p className="text-xs font-semibold mt-0.5 truncate">{getDestino(embarque)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground font-medium">ETD</p>
            <p className="text-xs font-semibold mt-0.5">{embarque.etd ? formatDate(embarque.etd) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground font-medium">ETA</p>
            <p className="text-xs font-semibold mt-0.5">{embarque.eta ? formatDate(embarque.eta) : "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="tracking" className="relative">
            Tracking
            {eventos.length > 0 && (
              <span className="ml-1.5 rounded-full bg-accent/10 text-accent text-[10px] px-1.5 font-bold">{eventos.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="documentos" className="relative">
            Documentos
            {docsTotal > 0 && (
              <span className="ml-1.5 rounded-full bg-accent/10 text-accent text-[10px] px-1.5 font-bold">{docsValidados}/{docsTotal}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          <PortalEmbarqueResumenTab embarque={embarque} />
        </TabsContent>

        <TabsContent value="tracking" className="space-y-4">
          <TrackingLiveCard
            embarqueId={embarque.id}
            modo={embarque.modo}
            naviera={embarque.naviera}
            contenedor={embarque.contenedor}
            readOnly
          />
          <PortalEmbarqueTimeline eventos={eventos} />
        </TabsContent>

        <TabsContent value="documentos">
          <PortalEmbarqueDocumentos documentos={documentos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
