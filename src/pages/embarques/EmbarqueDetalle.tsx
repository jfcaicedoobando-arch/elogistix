import { useParams, useNavigate } from "react-router-dom";
import { PackageX } from "lucide-react";
import { useState } from "react";

import EmptyState from "@/components/empty/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions, useTabsParam } from "@/hooks/shared";
import {
  calcularEstadoEmbarque,
  getSiguienteEstado,
  useEmbarqueDetalleData,
  useEmbarqueFinancials,
  useEmbarqueDetalleActions,
  useEmbarqueDetalleTracking,
} from "@/hooks/embarque";
import { TabResumen } from "@/components/embarque/TabResumen";
import { TabDocumentos } from "@/components/embarque/TabDocumentos";
import { TabCostos } from "@/components/embarque/TabCostos";
import { TabFacturacion } from "@/components/embarque/TabFacturacion";
import { TabNotas } from "@/components/embarque/TabNotas";
import { TabTracking } from "@/components/embarque/TabTracking";

import DialogEliminarEmbarque from "@/components/embarque/DialogEliminarEmbarque";
import { EmbarqueDetalleHeader } from "@/components/embarque/EmbarqueDetalleHeader";

import { useRegisterBreadcrumbLabel } from "@/contexts/BreadcrumbContext";

const TABS_VALIDOS = ["resumen", "documentos", "costos", "facturacion", "tracking", "notas"] as const;

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

  const { handleCompartirTracking, isPending: trackingPending } = useEmbarqueDetalleTracking(id);

  const {
    handleUpload, handleDeleteDoc, handleDownload, handleAvanzarEstado,
    downloadingDocId, avanzarEstado, uploadDoc, deleteDoc,
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
      />

      <DialogEliminarEmbarque embarque={embarque} open={dialogEliminarAbierto} onOpenChange={setDialogEliminarAbierto} />


      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="gap-1">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="costos">Costos</TabsTrigger>
          <TabsTrigger value="facturacion">Facturación</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="notas">Notas y Actividad</TabsTrigger>
        </TabsList>

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
            onUpload={handleUpload}
            onDownload={handleDownload}
            onDelete={handleDeleteDoc}
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

        <TabsContent value="facturacion">
          <TabFacturacion facturas={facturas} canEdit={canEdit} embarque={embarque} />
        </TabsContent>

        <TabsContent value="tracking">
          <TabTracking embarqueId={id!} embarque={embarque} notas={notas} />
        </TabsContent>

        <TabsContent value="notas">
          <TabNotas
            notas={notas}
            embarqueId={id}
            creadoPor={embarque.created_by_email ?? null}
            creadoEn={embarque.created_at}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
