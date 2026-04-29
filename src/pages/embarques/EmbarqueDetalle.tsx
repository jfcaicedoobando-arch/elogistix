import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { PackageX } from "lucide-react";

import EmptyState from "@/components/empty/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useState } from "react";
import { calcularEstadoEmbarque } from "@/hooks/embarque/useEmbarques";
import { useEmbarqueFull } from "@/hooks/embarque/useEmbarqueFullQuery";
import { useEmbarqueFinancials } from "@/hooks/embarque/useEmbarqueFinancials";
import { useEmbarqueDetalleActions, getSiguienteEstado } from "@/hooks/embarque/useEmbarqueDetalleActions";
import { TabResumen } from "@/components/embarque/TabResumen";
import { TabDocumentos } from "@/components/embarque/TabDocumentos";
import { TabCostos } from "@/components/embarque/TabCostos";
import { TabFacturacion } from "@/components/embarque/TabFacturacion";
import { TabNotas } from "@/components/embarque/TabNotas";
import { TabTracking } from "@/components/embarque/TabTracking";
import DialogDuplicarEmbarque from "@/components/embarque/DialogDuplicarEmbarque";
import DialogEliminarEmbarque from "@/components/embarque/DialogEliminarEmbarque";
import { useEmbarqueDetalleTracking } from "@/hooks/embarque/useEmbarqueDetalleTracking";
import { EmbarqueDetalleHeader } from "@/components/embarque/EmbarqueDetalleHeader";

import { useRegisterBreadcrumbLabel } from "@/contexts/BreadcrumbContext";

export default function EmbarqueDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canEdit } = usePermissions();
  const tabsValidos = ["resumen", "documentos", "costos", "facturacion", "tracking", "notas"] as const;
  const tabParam = searchParams.get("tab");
  const tabActivo = (tabsValidos as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as string)
    : "resumen";
  const handleTabChange = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === "resumen") next.delete("tab");
    else next.set("tab", v);
    setSearchParams(next, { replace: true });
  };
  // 1 sola llamada al backend en lugar de 6 (RPC get_embarque_full)
  const { data: full, isLoading } = useEmbarqueFull(id);
  const embarque = full?.embarque ?? null;
  const conceptosVenta = full?.conceptosVenta ?? [];
  const conceptosCosto = full?.conceptosCosto ?? [];
  const documentos = full?.documentos ?? [];
  const notas = full?.notas ?? [];
  const facturas = full?.facturas ?? [];
  useRegisterBreadcrumbLabel(id, embarque?.expediente);

  const [dialogDuplicarAbierto, setDialogDuplicarAbierto] = useState(false);
  const [dialogEliminarAbierto, setDialogEliminarAbierto] = useState(false);
  const { handleCompartirTracking, isPending: trackingPending } = useEmbarqueDetalleTracking(id);

  const {
    handleUpload, handleDeleteDoc, handleDownload, handleAvanzarEstado,
    downloadingDocId, avanzarEstado, uploadDoc, deleteDoc,
  } = useEmbarqueDetalleActions(embarque, id);

  const tipoCambioUSD = embarque ? (Number(embarque.tipo_cambio_usd) || 1) : 1;
  const tipoCambioEUR = embarque ? (Number(embarque.tipo_cambio_eur) || 1) : 1;

  const { totalVenta, totalCosto, utilidad, margen } = useEmbarqueFinancials({
    conceptosVenta, conceptosCosto, tipoCambioUSD, tipoCambioEUR,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!embarque) {
    return (
      <EmptyState
        icon={PackageX}
        title="Embarque no encontrado"
        description="El embarque que buscas no existe, fue eliminado o no tienes permiso para verlo."
        primaryAction={{ label: "Volver a embarques", onClick: () => navigate("/embarques") }}
      />
    );
  }

  const estadoVisual = calcularEstadoEmbarque(embarque.modo, embarque.tipo, embarque.etd, embarque.eta, embarque.estado);
  const siguienteEstado = getSiguienteEstado(estadoVisual);

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
        onAbrirDuplicar={() => setDialogDuplicarAbierto(true)}
        onAbrirEliminar={() => setDialogEliminarAbierto(true)}
      />

      <DialogDuplicarEmbarque embarque={embarque} open={dialogDuplicarAbierto} onOpenChange={setDialogDuplicarAbierto} />
      <DialogEliminarEmbarque embarque={embarque} open={dialogEliminarAbierto} onOpenChange={setDialogEliminarAbierto} />

      <Tabs value={tabActivo} onValueChange={handleTabChange}>
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
            documentos={documentos}
            canEdit={canEdit}
            uploadingDocId={uploadDoc.isPending ? (uploadDoc.variables?.docId ?? null) : null}
            downloadingDocId={downloadingDocId}
            deletingDocId={deleteDoc.isPending ? (deleteDoc.variables?.docId ?? null) : null}
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
          />
        </TabsContent>

        <TabsContent value="facturacion">
          <TabFacturacion facturas={facturas} canEdit={canEdit} embarque={embarque} />
        </TabsContent>

        <TabsContent value="tracking">
          <TabTracking embarqueId={id!} />
        </TabsContent>

        <TabsContent value="notas">
          <TabNotas notas={notas} embarqueId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
