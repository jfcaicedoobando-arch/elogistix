import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FileEdit } from "lucide-react";
import { TabResumen } from "@/features/embarques/components/TabResumen";
import { TabDocumentos } from "@/features/embarques/components/TabDocumentos";
import { TabFacturasEntrantes } from "@/features/embarques/components/TabFacturasEntrantes";
import { TabCostos } from "@/features/embarques/components/TabCostos";
import { TabFacturacion } from "@/features/embarques/components/TabFacturacion";
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
import type {
  EmbarqueDetalleTabsProps,
  PnlView,
} from "./_sections/embarqueDetalleTabsTypes";

export function EmbarqueDetalleTabs({
  embarque, embarqueId, activeTab, setActiveTab, estadoVisual, canEdit,
}: EmbarqueDetalleTabsProps) {
  const [pnlView, setPnlView] = useState<PnlView>("global");
  // v13.309.24 · Ítem 3.5: data-fetching movido a este hook (antes vivía en la ruta).
  // v13.309.50 · PR-S2-B: `EmbarqueProp` ahora es alias de `EmbarqueRow`, ya no
  // se requiere el el cast doble histórico.
  const { conceptosCosto, documentos, notas, facturas, financials, docHandlers } =
    useEmbarqueDetalleTabsData(embarqueId, embarque);

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
          para mantener todas las tabs en una sola fila sin partir el header. */}
      <div className="w-full overflow-x-auto [scrollbar-width:thin]">
        <TabsList className="gap-1 inline-flex w-max flex-nowrap" data-testid="embarque-detalle-tabs">
          <TabsTrigger value="resumen" data-testid="tab-resumen" className="whitespace-nowrap">Resumen</TabsTrigger>
          <TabsTrigger value="tracking" data-testid="tab-tracking" className="whitespace-nowrap">Tracking</TabsTrigger>
          <TabsTrigger value="documentos" data-testid="tab-documentos" className="whitespace-nowrap">Documentos</TabsTrigger>
          <TabsTrigger value="costos" data-testid="tab-costos" className="whitespace-nowrap">Costos</TabsTrigger>
          <TabsTrigger value="garantias" data-testid="tab-garantias" className="whitespace-nowrap">Demoras y Garantías</TabsTrigger>
          <TabsTrigger value="seguros" data-testid="tab-seguros" className="whitespace-nowrap">Seguros</TabsTrigger>
          <TabsTrigger value="facturacion" data-testid="tab-facturacion" className="whitespace-nowrap">Facturación</TabsTrigger>
          <TabsTrigger value="conciliacion" data-testid="tab-conciliacion" className="whitespace-nowrap">Conciliación</TabsTrigger>
          <TabsTrigger value="pnl" data-testid="tab-pnl" className="whitespace-nowrap">P&amp;L</TabsTrigger>
          <TabsTrigger value="cierre" data-testid="tab-cierre" className="whitespace-nowrap">Cierre</TabsTrigger>
          <TabsTrigger value="notas" data-testid="tab-notas" className="whitespace-nowrap">Notas y Actividad</TabsTrigger>
        </TabsList>
      </div>

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
        />
      </TabsContent>

      {/* v13.346.0 — Buzón CxP: operación entrega el invoice, contabilidad lo captura. */}
      <TabsContent value="facturas-entrantes">
        <TabFacturasEntrantes embarqueId={embarqueId} canEdit={canEdit} />
      </TabsContent>

      <TabsContent value="costos" className="space-y-6">
        <TabCostos
          
          conceptosCosto={conceptosCosto}
          totalVenta={financials.totalVenta}
          totalCosto={financials.totalCosto}
          utilidad={financials.utilidad}
          margen={financials.margen}
          embarqueId={embarqueId}
          canEdit={canEdit}
        />
      </TabsContent>

      {/* Garantías y Demoras fusionadas (v13.66.15): mismo dominio (free time / depósito por contenedor). */}
      <TabsContent value="garantias" className="space-y-6">
        <section aria-labelledby="seccion-demoras" className="space-y-3">
          <h2 id="seccion-demoras" className="text-base font-semibold">Demoras</h2>
          <SeccionDemorasAuto embarqueId={embarqueId} canEdit={canEdit} />
          <TabDemoras embarqueId={embarqueId} canEdit={canEdit} />
        </section>
        <Separator />
        <section aria-labelledby="seccion-garantias" className="space-y-3">
          <h2 id="seccion-garantias" className="text-base font-semibold">Garantías</h2>
          <TabGarantias embarqueId={embarqueId} canEdit={canEdit} fechaLlegadaReal={embarque.fecha_llegada_real ?? null} />
        </section>
      </TabsContent>

      <TabsContent value="seguros">
        <TabSeguros embarqueId={embarqueId} canEdit={canEdit} />
      </TabsContent>

      <TabsContent value="facturacion">
        <TabFacturacion facturas={facturas} canEdit={canEdit} embarque={embarque} />
      </TabsContent>

      <TabsContent value="conciliacion" className="space-y-6">
        <TabConciliacion embarqueId={embarqueId} />
      </TabsContent>

      {/* P&L unificada (v13.66.15): toggle Global / Por contenedor. */}
      <TabsContent value="pnl" className="space-y-4">
        <div className="flex items-center justify-end">
          <ToggleGroup
            type="single"
            value={pnlView}
            onValueChange={(v) => { if (v) setPnlView(v as PnlView); }}
          >
            <ToggleGroupItem value="global" aria-label="Vista global">Global</ToggleGroupItem>
            <ToggleGroupItem value="contenedor" aria-label="Vista por contenedor">Por contenedor</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {pnlView === "global"
          ? <TabPnl embarqueId={embarqueId} />
          : <TabPnlContenedor embarqueId={embarqueId} expediente={embarque.expediente ?? ""} />}
      </TabsContent>

      <TabsContent value="cierre" className="space-y-6">
        <TabCierre embarqueId={embarqueId} estatus={embarque.estado ?? ""} modo={embarque.modo} />
      </TabsContent>

      <TabsContent value="notas">
        <TabNotas
          notas={notas}
          embarqueId={embarqueId}
          expediente={embarque.expediente}
          creadoPor={embarque.created_by_email ?? null}
          creadoEn={embarque.created_at}
        />
      </TabsContent>
    </Tabs>
  );
}
