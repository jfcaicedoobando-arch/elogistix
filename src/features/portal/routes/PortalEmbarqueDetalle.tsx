import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { formatDate, getOrigen, getDestino } from "@/lib/formatters";
import { PortalEmbarqueTimeline } from "@/features/portal/components/PortalEmbarqueTimeline";
import { PortalEmbarqueDocumentos } from "@/features/portal/components/PortalEmbarqueDocumentos";
import { PortalEmbarqueResumenTab } from "@/features/portal/components/embarqueDetalle/PortalEmbarqueResumenTab";
import { PortalEmbarqueStepper } from "@/features/portal/components/embarqueDetalle/PortalEmbarqueStepper";


import { usePortalEmbarqueDetalleController } from "@/features/embarques/hooks";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";

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
    return <DetailSkeleton />;
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
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/portal/embarques")}
        className="-ml-2 mb-1"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      <PageHeader
        icon={<Ship className="h-6 w-6 text-accent" />}
        title={
          <span className="flex items-center gap-2">
            <span className="break-all">{embarque.expediente}</span>
            <ModoIcon modo={embarque.modo} size={18} circle />
          </span>
        }
        description={
          <span className="flex items-center gap-2 flex-wrap">
            <Badge className={getEstadoColor(estadoVisual ?? "")}>{estadoVisual}</Badge>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {embarque.tipo} • {embarque.modo} • {embarque.incoterm}
            </span>
          </span>
        }
      />


      {/* Progress Tracker */}
      <PortalEmbarqueStepper
        progressSteps={progressSteps}
        currentStepIndex={currentStepIndex}
        diasParaEta={diasParaEta}
        eta={embarque.eta}
      />


      {/* Quick Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xs text-muted-foreground font-medium">Origen</p>
            <p className="text-xs font-semibold mt-0.5 truncate" title={getOrigen(embarque)}>{getOrigen(embarque)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xs text-muted-foreground font-medium">Destino</p>
            <p className="text-xs font-semibold mt-0.5 truncate" title={getDestino(embarque)}>{getDestino(embarque)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xs text-muted-foreground font-medium" title="Fecha estimada de salida">ETD</p>
            <p className="text-xs font-semibold mt-0.5">{embarque.etd ? formatDate(embarque.etd) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xs text-muted-foreground font-medium" title="Fecha estimada de arribo">ETA</p>
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
              <span className="ml-1.5 rounded-full bg-accent/10 text-accent text-2xs px-1.5 font-bold">{eventos.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="documentos" className="relative">
            Documentos
            {docsTotal > 0 && (
              <span className="ml-1.5 rounded-full bg-accent/10 text-accent text-2xs px-1.5 font-bold">{docsValidados}/{docsTotal}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          <PortalEmbarqueResumenTab embarque={embarque} />
        </TabsContent>

        <TabsContent value="tracking" className="space-y-4">
          <PortalEmbarqueTimeline eventos={eventos} />
        </TabsContent>

        <TabsContent value="documentos">
          <PortalEmbarqueDocumentos documentos={documentos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
