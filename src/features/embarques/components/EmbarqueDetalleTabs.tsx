import { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { EmbarqueDetalleTabsBar } from "@/features/embarques/components/_sections/EmbarqueDetalleTabsBar";
import { Separator } from "@/components/ui/separator";
import { AlertaBorrador } from "@/features/embarques/components/_sections/AlertaBorrador";

import { TabResumen } from "@/features/embarques/components/TabResumen";
import { TabDocumentos } from "@/features/embarques/components/TabDocumentos";
import { TabFacturasEntrantes } from "@/features/embarques/components/TabFacturasEntrantes";
import { TabCostos } from "@/features/embarques/components/TabCostos";
import { TabFacturacionEmbarque } from "@/features/embarques/components/TabFacturacionEmbarque";
import { TabNotas } from "@/features/embarques/components/TabNotas";
import { TabTracking } from "@/features/embarques/components/TabTracking";
import { TabGarantias } from "@/features/embarques/components/TabGarantias";
import { TabConciliacion } from "@/features/embarques/components/TabConciliacion";
import { TabPnl } from "@/features/embarques/components/TabPnl";
import { TabPnlContenedor } from "@/features/embarques/components/TabPnlContenedor";
import { TabSeguros } from "@/features/embarques/components/TabSeguros";
import { TabCierre } from "@/features/embarques/components/TabCierre";
import { TabDemoras } from "@/features/embarques/components/TabDemoras";
import { SeccionDemorasAuto } from "@/features/embarques/components/financiero/SeccionDemorasAuto";
import { useEmbarqueDetalleTabsData } from "@/features/embarques/hooks/useEmbarqueDetalleTabsData";
import { useEmbarqueInterno } from "@/features/embarques/hooks/useEmbarqueInterno";
import { useContenedoresEmbarque } from "@/features/embarques/hooks/useContenedoresEmbarque";
import {
  monedasExtranjerasActivas,
  tieneContenedorOperativo,
} from "@/features/embarques/domain/pnlPresentacion";
import { SectionHeading } from "@/components/shared/SectionHeading";
import type {
  EmbarqueDetalleTabsProps,
  PnlView,
} from "./_sections/embarqueDetalleTabsTypes";
import { PnlViewSelector } from "./_sections/PnlViewSelector";
import { usePermissions } from "@/hooks/shared/usePermissions";

export function EmbarqueDetalleTabs({
  embarque, embarqueId, activeTab, setActiveTab, estadoVisual, canEdit,
}: EmbarqueDetalleTabsProps) {
  const [pnlView, setPnlView] = useState<PnlView>("global");
  // B1 (v13.823.395): «Cargar costos» exige la capacidad estrecha, no el
  // `canEdit` genérico que también cubre documentos y tracking.
  const { canEditCostosEmbarque } = usePermissions();
  // v13.309.24 · Ítem 3.5: data-fetching movido a este hook (antes vivía en la ruta).
  // v13.309.50 · PR-S2-B: `EmbarqueProp` ahora es alias de `EmbarqueRow`, ya no
  // se requiere el el cast doble histórico.
  const { conceptosVenta, conceptosCosto, documentos, notas, facturas, financials, docHandlers } =
    useEmbarqueDetalleTabsData(embarqueId, embarque);
  const { data: contenedores = [] } = useContenedoresEmbarque(embarqueId);
  const permitePnlContenedor = tieneContenedorOperativo(contenedores);
  const monedasExtranjeras = monedasExtranjerasActivas(conceptosVenta, conceptosCosto);
  // `created_by_email` no es legible en la tabla `embarques`: viene de la vista
  // interna (staff), no de la fila de detalle.
  const { data: interno } = useEmbarqueInterno(embarqueId);


  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      {/*
        Orden por flujo (v13.66.15):
          Operación: Resumen · Tracking · Documentos
          Finanzas:  Costos · Garantías y Demoras · Seguros · P&L · Facturación · Conciliación
          Cierre:    Cierre
          Bitácora:  Notas y Actividad
      */}
      {/* v13.139.18 (F-04 auditoría 3): 11 tabs desbordaban a 2ª línea con
          flex-wrap. Cambiamos a scroll horizontal nativo con scrollbar fino
          para mantener todas las tabs en una sola fila sin partir el header.
          v13.823.26: la affordance de scroll (degradados + flechas) vive en
          `EmbarqueDetalleTabsBar` para mantener este archivo enfocado en el
          contenido de cada pestaña. */}
      <EmbarqueDetalleTabsBar />

      {estadoVisual === "Borrador" && <AlertaBorrador etd={embarque.etd ?? null} />}


      <TabsContent value="resumen" className="space-y-6">
        <TabResumen embarque={embarque} />
      </TabsContent>

      <TabsContent value="tracking">
        <TabTracking embarqueId={embarqueId} embarque={embarque} />
      </TabsContent>

      <TabsContent value="documentos">
        <TabDocumentos
          embarqueId={embarqueId}
          modo={embarque.modo}
          documentos={documentos}
          canEdit={canEdit}
          uploadingDocId={docHandlers.uploadingDocId}
          downloadingDocId={docHandlers.downloadingDocId}
          deletingDocId={docHandlers.deletingDocId}
          togglingNoAplicaDocId={docHandlers.togglingNoAplicaDocId}
          onUpload={docHandlers.onUpload}
          onDownload={docHandlers.onDownload}
          onDelete={docHandlers.onDelete}
          onToggleNoAplica={docHandlers.onToggleNoAplica}
          rechazandoDocId={docHandlers.rechazandoDocId}
          onRechazar={docHandlers.onRechazar}
        />
      </TabsContent>
      {/* v13.347.0 — Costos y facturas de proveedor fusionados: el buzón CxP vive
          junto a los conceptos de costo que documenta. */}
      <TabsContent value="costos" className="space-y-6">
        <TabCostos
          conceptosCosto={conceptosCosto}
          totalVenta={financials.totalVenta}
          totalCosto={financials.totalCosto}
          utilidad={financials.utilidad}
          margen={financials.margen}
          embarqueId={embarqueId}
          canEditCostos={canEditCostosEmbarque}
        />
        <Separator />
        <TabFacturasEntrantes embarqueId={embarqueId} canEdit={canEdit} />
      </TabsContent>

      {/* Garantías y Demoras fusionadas (v13.66.15): mismo dominio (free time / depósito por contenedor). */}
      <TabsContent value="garantias" className="space-y-6">
        <section aria-labelledby="seccion-demoras" className="space-y-3">
          <SectionHeading id="seccion-demoras">Demoras</SectionHeading>
          <SeccionDemorasAuto embarqueId={embarqueId} canEdit={canEdit} />
          <TabDemoras embarqueId={embarqueId} canEdit={canEdit} />
        </section>
        <Separator />
        <section aria-labelledby="seccion-garantias" className="space-y-3">
          <SectionHeading id="seccion-garantias">Garantías</SectionHeading>
          <TabGarantias embarqueId={embarqueId} canEdit={canEdit} fechaLlegadaReal={embarque.fecha_llegada_real ?? null} />
        </section>
      </TabsContent>

      <TabsContent value="seguros">
        <TabSeguros embarqueId={embarqueId} canEdit={canEdit} />
      </TabsContent>

      <TabsContent value="facturacion">
        <TabFacturacionEmbarque facturas={facturas} canEdit={canEdit} embarque={embarque} />
      </TabsContent>

      <TabsContent value="conciliacion" className="space-y-6">
        <TabConciliacion embarqueId={embarqueId} />
      </TabsContent>

      {/* P&L unificada (v13.66.15): toggle Global / Por contenedor. */}
      <TabsContent value="pnl" className="space-y-4">
        <PnlViewSelector
          visible={permitePnlContenedor}
          value={pnlView}
          onChange={setPnlView}
        />
        {pnlView === "global" || !permitePnlContenedor
          ? <TabPnl embarqueId={embarqueId} estadoEmbarque={embarque.estado} monedasExtranjeras={monedasExtranjeras} />
          : <TabPnlContenedor embarqueId={embarqueId} expediente={embarque.expediente ?? ""} />}
      </TabsContent>

      <TabsContent value="cierre" className="space-y-6">
        <TabCierre
          embarqueId={embarqueId}
          estatus={embarque.estado ?? ""}
          modo={embarque.modo}
          expediente={embarque.expediente ?? ""}
          docsRequeridos={documentos.filter((d) => d.estado !== "No aplica").length}
        />
      </TabsContent>

      <TabsContent value="notas">
        <TabNotas
          notas={notas}
          embarqueId={embarqueId}
          expediente={embarque.expediente}
          creadoPor={interno?.created_by_email ?? null}
          creadoEn={embarque.created_at}
        />
      </TabsContent>
    </Tabs>
  );
}
