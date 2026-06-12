import { useParams, useNavigate } from "react-router-dom";
import { PackageX } from "lucide-react";
import { useState } from "react";

import EmptyState from "@/components/empty/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileEdit } from "lucide-react";
import { usePermissions, useTabsParam } from "@/hooks/shared";
import {
  calcularEstadoEmbarque,
  getSiguienteEstado,
  useEmbarqueDetalleData,
  useEmbarqueFinancials,
  useEmbarqueDetalleActions,
  useEmbarqueDetalleTracking,
} from "@/features/embarques/hooks";
import { TabResumen } from "@/features/embarques/components/TabResumen";
import { TabDocumentos } from "@/features/embarques/components/TabDocumentos";
import { TabCostos } from "@/features/embarques/components/TabCostos";
import { TabFacturacion } from "@/features/embarques/components/TabFacturacion";
import { TabNotas } from "@/features/embarques/components/TabNotas";
import { TabTracking } from "@/features/embarques/components/TabTracking";
import { TabGarantias } from "@/features/embarques/components/TabGarantias";
import { TabConciliacion } from "@/features/embarques/components/TabConciliacion";

import DialogEliminarEmbarque from "@/features/embarques/components/DialogEliminarEmbarque";
import DialogDuplicarEmbarque from "@/features/embarques/components/DialogDuplicarEmbarque";
import { EmbarqueDetalleHeader } from "@/features/embarques/components/EmbarqueDetalleHeader";

import { useRegisterBreadcrumbLabel } from "@/contexts/BreadcrumbContext";

const TABS_VALIDOS = ["resumen", "documentos", "costos", "conciliacion", "facturacion", "garantias", "tracking", "notas"] as const;

function LoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <EmptyState
      icon={PackageX}
      title="Embarque no encontrado"
      description="El embarque que buscas no existe, fue eliminado o no tienes permiso para verlo."
      primaryAction={{ label: "Volver a embarques", onClick: onBack }}
    />
  );
}

export default function EmbarqueDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { activeTab, setActiveTab } = useTabsParam(TABS_VALIDOS, "resumen");

  const {
    embarque, conceptosVenta, conceptosCosto, documentos, notas, facturas,
    tipoCambioUSD, tipoCambioEUR, isLoading,
  } = useEmbarqueDetalleData(id);
  useRegisterBreadcrumbLabel(id, embarque?.expediente);

  const [dialogEliminarAbierto, setDialogEliminarAbierto] = useState(false);
  const [dialogDuplicarAbierto, setDialogDuplicarAbierto] = useState(false);

  const { handleCompartirTracking, isPending: trackingPending } = useEmbarqueDetalleTracking(id);

  const {
    handleUpload, handleDeleteDoc, handleDownload, handleToggleNoAplica, handleAvanzarEstado,
    handleReabrir, reabrirEmbarque,
    warnCierreOpen, setWarnCierreOpen, confirmarCierreSinProforma, conceptosSinProforma,
    downloadingDocId, avanzarEstado, uploadDoc, deleteDoc, setNoAplica,
  } = useEmbarqueDetalleActions(embarque ?? undefined, id);

  const { totalVenta, totalCosto, utilidad, margen } = useEmbarqueFinancials({
    conceptosVenta, conceptosCosto, tipoCambioUSD, tipoCambioEUR,
  });

  if (isLoading) return <LoadingState />;
  if (!embarque) return <NotFoundState onBack={() => navigate("/embarques")} />;

  const estadoVisual = calcularEstadoEmbarque(embarque.modo, embarque.tipo, embarque.etd, embarque.eta, embarque.estado);
  const siguienteEstado = getSiguienteEstado(estadoVisual);
  const uploadingDocId = uploadDoc.isPending ? (uploadDoc.variables?.docId ?? null) : null;
  const deletingDocId = deleteDoc.isPending ? (deleteDoc.variables?.docId ?? null) : null;
  const togglingNoAplicaDocId = setNoAplica.isPending ? (setNoAplica.variables?.docId ?? null) : null;

  return (
    <div className="space-y-6">
      <EmbarqueDetalleHeader
        embarque={embarque}
        estadoVisual={estadoVisual}
        siguienteEstado={siguienteEstado}
        canEdit={canEdit}
        avanzandoEstado={avanzarEstado.isPending}
        trackingPending={trackingPending}
        embarqueId={id!}
        onAvanzarEstado={handleAvanzarEstado}
        onCompartirTracking={handleCompartirTracking}
        onAbrirEliminar={() => setDialogEliminarAbierto(true)}
        onAbrirDuplicar={() => setDialogDuplicarAbierto(true)}
        onReabrir={handleReabrir}
        reabriendoEstado={reabrirEmbarque.isPending}
        warnCierreOpen={warnCierreOpen}
        onWarnCierreOpenChange={setWarnCierreOpen}
        onConfirmarCierreSinProforma={confirmarCierreSinProforma}
        conceptosSinProforma={conceptosSinProforma}
      />

      <DialogEliminarEmbarque embarque={embarque} open={dialogEliminarAbierto} onOpenChange={setDialogEliminarAbierto} />
      <DialogDuplicarEmbarque embarque={embarque} open={dialogDuplicarAbierto} onOpenChange={setDialogDuplicarAbierto} />


      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="gap-1">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="costos">Costos</TabsTrigger>
          <TabsTrigger value="conciliacion">Conciliación</TabsTrigger>
          <TabsTrigger value="facturacion">Facturación</TabsTrigger>
          <TabsTrigger value="garantias">Garantías</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="notas">Notas y Actividad</TabsTrigger>
        </TabsList>
      {estadoVisual === "Borrador" && (
        <Alert variant="warning">
          <FileEdit className="h-4 w-4" />
          <AlertTitle>Embarque en borrador</AlertTitle>
          <AlertDescription>
            Este embarque fue generado desde la cotización. Complétalo y cambia su estado a Confirmado para continuar con la operación.
          </AlertDescription>
        </Alert>
      )}


        <TabsContent value="resumen" className="space-y-6">
          <TabResumen embarque={embarque} />
        </TabsContent>

        <TabsContent value="documentos">
          <TabDocumentos
            embarqueId={id!}
            modo={embarque.modo}
            documentos={documentos}
            canEdit={canEdit}
            uploadingDocId={uploadingDocId}
            downloadingDocId={downloadingDocId}
            deletingDocId={deletingDocId}
            togglingNoAplicaDocId={togglingNoAplicaDocId}
            onUpload={handleUpload}
            onDownload={handleDownload}
            onDelete={handleDeleteDoc}
            onToggleNoAplica={handleToggleNoAplica}
          />
        </TabsContent>

        <TabsContent value="costos" className="space-y-6">
          <TabCostos
            conceptosVenta={conceptosVenta}
            conceptosCosto={conceptosCosto}
            totalVenta={totalVenta}
            totalCosto={totalCosto}
            utilidad={utilidad}
            margen={margen}
            embarqueId={id!}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="conciliacion" className="space-y-6">
          <TabConciliacion embarqueId={id!} />
        </TabsContent>



        <TabsContent value="facturacion">
          <TabFacturacion facturas={facturas} canEdit={canEdit} embarque={embarque} />
        </TabsContent>

        <TabsContent value="garantias">
          <TabGarantias embarqueId={id!} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="tracking">
          <TabTracking embarqueId={id!} embarque={embarque} notas={notas} />
        </TabsContent>

        <TabsContent value="notas">
          <TabNotas
            notas={notas}
            embarqueId={id}
            expediente={embarque.expediente}
            creadoPor={embarque.created_by_email ?? null}
            creadoEn={embarque.created_at}
          />
        </TabsContent>

      </Tabs>
    </div>
  );
}
