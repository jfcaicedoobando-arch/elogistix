import { PortalPageShell } from "@/features/portal/components/layout/PortalPageShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useParams } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { Ship } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import EmptyState from "@/components/empty/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { formatDate, getOrigen, getDestino } from "@/lib/formatters";
import { PortalEmbarqueTimeline } from "@/features/portal/components/PortalEmbarqueTimeline";
import { PortalEmbarqueDocumentos } from "@/features/portal/components/PortalEmbarqueDocumentos";
import { PortalEmbarqueResumenTab } from "@/features/portal/components/embarqueDetalle/PortalEmbarqueResumenTab";
import { PortalEmbarqueStepper } from "@/features/portal/components/embarqueDetalle/PortalEmbarqueStepper";
import { filtrarEventosVisiblesCliente } from "@/lib/domain/eventosVisiblesCliente";


import { usePortalEmbarqueDetalleController } from "@/features/embarques/hooks";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { useDocumentTitle } from "@/hooks/shared";
import { useVolver } from "@/hooks/shared/useVolver";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { Hint } from "@/components/shared/Hint";

export default function PortalEmbarqueDetalle() {
  const { id } = useParams();
  const volver = useVolver(ROUTES.PORTAL_EMBARQUES);
  const {
    embarque,
    isLoading,
    isError,
    refetch,
    eventos,
    eventosError,
    refetchEventos,
    documentos,
    documentosError,
    refetchDocumentos,
    estadoVisual,
    currentStepIndex,
    diasParaEta,
    docsValidados,
    docsTotal,
    progressSteps,
  } = usePortalEmbarqueDetalleController(id);
  useRegisterBreadcrumbLabel(id, embarque?.expediente);
  useDocumentTitle(embarque ? `Embarque · ${embarque.expediente}` : "Embarque");

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!embarque) {
    return (
      <EmptyState
        icon={Ship}
        title="Embarque no encontrado"
        primaryAction={{ label: "Volver", onClick: volver, variant: "outline" }}
      />
    );
  }

  // UIB-12: el badge del tab debe contar lo mismo que la línea de tiempo
  // muestra (hitos visibles para el cliente), no los eventos crudos.
  const eventosVisiblesCount = filtrarEventosVisiblesCliente(eventos).length;


  return (
    <PortalPageShell>
      <DetailHeader
        backTo={volver}
        backLabel="Volver a Embarques"
        icon={<Ship className="h-6 w-6 text-accent shrink-0" />}
        title={embarque.expediente}
        subtitle={`${embarque.tipo} • ${embarque.modo} • ${embarque.incoterm}`}
        badge={
          <>
            <StatusBadge domain="embarque" status={estadoVisual} showIcon />
            <ModoIcon modo={embarque.modo} size={16} circle />
          </>
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
            <p className="text-label text-muted-foreground font-medium">Origen</p>
            <Hint label={getOrigen(embarque)}>
              <p className="text-body-sm font-semibold mt-0.5 truncate">{getOrigen(embarque)}</p>
            </Hint>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-label text-muted-foreground font-medium">Destino</p>
            <Hint label={getDestino(embarque)}>
              <p className="text-body-sm font-semibold mt-0.5 truncate">{getDestino(embarque)}</p>
            </Hint>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Hint label="Fecha estimada de salida">
              <p className="text-label text-muted-foreground font-medium">ETD</p>
            </Hint>
            <p className="text-body-sm font-semibold mt-0.5">{embarque.etd ? formatDate(embarque.etd) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Hint label="Fecha estimada de arribo">
              <p className="text-label text-muted-foreground font-medium">ETA</p>
            </Hint>
            <p className="text-body-sm font-semibold mt-0.5">{embarque.eta ? formatDate(embarque.eta) : "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="tracking" className="relative">
            Tracking
            {eventosVisiblesCount > 0 && (
              <span className="ml-1.5 rounded-full bg-accent/10 text-accent text-label px-1.5 font-bold">{eventosVisiblesCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="documentos" className="relative">
            Documentos
            {docsTotal > 0 && (
              <span className="ml-1.5 rounded-full bg-accent/10 text-accent text-label px-1.5 font-bold">{docsValidados}/{docsTotal}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          <PortalEmbarqueResumenTab embarque={embarque} />
        </TabsContent>

        <TabsContent value="tracking" className="space-y-4">
          {/* Defecto 5: un fallo de carga se muestra como error con reintento,
              nunca como una línea de tiempo vacía. */}
          {eventosError ? (
            <ErrorStateInline
              message="No pudimos cargar la línea de tiempo de este embarque."
              onRetry={() => void refetchEventos()}
            />
          ) : (
            <PortalEmbarqueTimeline eventos={eventos} />
          )}
        </TabsContent>

        <TabsContent value="documentos">
          {documentosError ? (
            <ErrorStateInline
              message="No pudimos cargar los documentos de este embarque."
              onRetry={() => void refetchDocumentos()}
            />
          ) : (
            <PortalEmbarqueDocumentos documentos={documentos} />
          )}
        </TabsContent>
      </Tabs>
    </PortalPageShell>
  );
}
