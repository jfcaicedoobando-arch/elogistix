import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";

import { usePermissions, useTabsParam } from "@/hooks/shared";
import {
  calcularEstadoEmbarque,
  getSiguienteEstado,
  useEmbarqueDetalleData,
  useEmbarqueFinancials,
  useEmbarqueDetalleActions,
  useEmbarqueDetalleTracking,
} from "@/features/embarques/hooks";

import DialogEliminarEmbarque from "@/features/embarques/components/DialogEliminarEmbarque";
import DialogDuplicarEmbarque from "@/features/embarques/components/DialogDuplicarEmbarque";
import { EmbarqueDetalleHeader } from "@/features/embarques/components/EmbarqueDetalleHeader";
import { EmbarqueDetalleTabs } from "@/features/embarques/components/EmbarqueDetalleTabs";
import { LoadingState, NotFoundState } from "./EmbarqueDetalleStates";

import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";

// v13.66.15: reordenadas por flujo (operación → finanzas → cierre → bitácora)
// y fusionadas (P&L+P&L Contenedor, Garantías+Demoras).
const TABS_VALIDOS = [
  "resumen", "tracking", "documentos",
  "costos", "garantias", "seguros", "pnl", "facturacion", "conciliacion",
  "cierre", "notas",
] as const;

// Mapa de compatibilidad con deep-links antiguos (?tab=pnl-contenedor, ?tab=demoras).
const TABS_LEGACY: Record<string, (typeof TABS_VALIDOS)[number]> = {
  "pnl-contenedor": "pnl",
  "demoras": "garantias",
};

export default function EmbarqueDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { activeTab, setActiveTab } = useTabsParam(TABS_VALIDOS, "resumen", "tab", TABS_LEGACY);

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
    docsFaltantes, docsBloqueantes,
    warnDocsOpen, setWarnDocsOpen, blockDocsOpen, setBlockDocsOpen,
    confirmarAvanceConDocsPendientes,
    downloadingDocId, avanzarEstado, uploadDoc, deleteDoc, setNoAplica,
    cierreEsSiguiente, rolPuedeCerrar, cierrePuedeAvanzar, cierreMotivoBloqueo,
  } = useEmbarqueDetalleActions(embarque ?? undefined, id);

  const financials = useEmbarqueFinancials({
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
    <PageContainer>
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
        docsFaltantes={docsFaltantes}
        docsBloqueantes={docsBloqueantes}
        warnDocsOpen={warnDocsOpen}
        onWarnDocsOpenChange={setWarnDocsOpen}
        blockDocsOpen={blockDocsOpen}
        onBlockDocsOpenChange={setBlockDocsOpen}
        onConfirmarAvanceConDocsPendientes={confirmarAvanceConDocsPendientes}
        onIrADocumentos={() => { setBlockDocsOpen(false); setActiveTab("documentos"); }}
        cierreEsSiguiente={cierreEsSiguiente}
        rolPuedeCerrar={rolPuedeCerrar}
        cierrePuedeAvanzar={cierrePuedeAvanzar}
        cierreMotivoBloqueo={cierreMotivoBloqueo}
        onIrACierre={() => setActiveTab("cierre")}
      />


      <DialogEliminarEmbarque embarque={embarque} open={dialogEliminarAbierto} onOpenChange={setDialogEliminarAbierto} />
      <DialogDuplicarEmbarque embarque={embarque} open={dialogDuplicarAbierto} onOpenChange={setDialogDuplicarAbierto} />

      <EmbarqueDetalleTabs
        embarque={embarque}
        embarqueId={id!}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        estadoVisual={estadoVisual}
        canEdit={canEdit}
        documentos={documentos}
        conceptosVenta={conceptosVenta}
        conceptosCosto={conceptosCosto}
        facturas={facturas}
        notas={notas}
        financials={financials}
        docHandlers={{
          uploadingDocId,
          downloadingDocId,
          deletingDocId,
          togglingNoAplicaDocId,
          onUpload: handleUpload,
          onDownload: handleDownload,
          onDelete: handleDeleteDoc,
          onToggleNoAplica: handleToggleNoAplica,
        }}
      />
    </div>
  );
}
