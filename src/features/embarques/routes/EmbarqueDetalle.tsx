"use memo";
import { useParams } from "react-router-dom";
import { PageContainer } from "@/components/shared/PageContainer";
import { useState } from "react";

import { usePermissions, useTabsParam } from "@/hooks/shared";
import {
  calcularEstadoEmbarque,
  getSiguienteEstado,
  useEmbarqueDetalleData,
  useEmbarqueDetalleTracking,
} from "@/features/embarques/hooks";


import DialogEliminarEmbarque from "@/features/embarques/components/DialogEliminarEmbarque";
import DialogDuplicarEmbarque from "@/features/embarques/components/DialogDuplicarEmbarque";
import { EmbarqueDetalleHeader } from "@/features/embarques/components/EmbarqueDetalleHeader";
import { EmbarqueDetalleTabs } from "@/features/embarques/components/EmbarqueDetalleTabs";
import { LoadingState, NotFoundState } from "./EmbarqueDetalleStates";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { getErrorMessage } from "@/lib/errors";

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

/**
 * v13.309.24 · Ítem 3.5 auditoría 3: se movió la data-fetching y el cómputo de
 * `financials`/`docHandlers` a `useEmbarqueDetalleTabsData` (dentro de Tabs).
 * La ruta ahora sólo orquesta el header (embarque + estado + diálogos globales).
 * `useEmbarqueEstadoActions` reemplaza a `useEmbarqueDetalleActions` para evitar
 * instanciar mutaciones de documentos aquí — ésas viven exclusivamente en Tabs.
 */
export default function EmbarqueDetalle() {
  const { id } = useParams();
  const { canEdit } = usePermissions();
  const { activeTab, setActiveTab } = useTabsParam(TABS_VALIDOS, "resumen", "tab", TABS_LEGACY);

  const { embarque, isLoading, error, refetch } = useEmbarqueDetalleData(id);
  useRegisterBreadcrumbLabel(id, embarque?.expediente);

  const [dialogEliminarAbierto, setDialogEliminarAbierto] = useState(false);
  const [dialogDuplicarAbierto, setDialogDuplicarAbierto] = useState(false);

  const { handleCompartirTracking, isPending: trackingPending } = useEmbarqueDetalleTracking(id);

  if (error) {
    return (
      <PageContainer>
        <ErrorStateInline message={getErrorMessage(error)} onRetry={() => refetch()} />
      </PageContainer>
    );
  }
  if (isLoading) return <LoadingState />;
  if (!embarque) return <NotFoundState />;

  const estadoVisual = calcularEstadoEmbarque(embarque.modo, embarque.tipo, embarque.etd, embarque.eta, embarque.estado, embarque.fecha_llegada_real);
  const siguienteEstado = getSiguienteEstado(estadoVisual);

  return (
    <PageContainer>
      <EmbarqueDetalleHeader
        embarque={embarque}
        embarqueId={id!}
        estadoVisual={estadoVisual}
        siguienteEstado={siguienteEstado}
        canEdit={canEdit}
        trackingPending={trackingPending}
        onCompartirTracking={handleCompartirTracking}
        onAbrirEliminar={() => setDialogEliminarAbierto(true)}
        onAbrirDuplicar={() => setDialogDuplicarAbierto(true)}
        onNavigateTab={(tab) => setActiveTab(tab)}
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
      />
    </PageContainer>
  );
}
