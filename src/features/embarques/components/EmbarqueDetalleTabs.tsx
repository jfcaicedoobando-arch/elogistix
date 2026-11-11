import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { EmbarqueDetalleTabsBar } from "@/features/embarques/components/_sections/EmbarqueDetalleTabsBar";
import { Separator } from "@/components/ui/separator";
import { AlertaBorrador } from "@/features/embarques/components/_sections/AlertaBorrador";

import { useEmbarqueDetalleTabsData } from "@/features/embarques/hooks/useEmbarqueDetalleTabsData";
import { useEmbarqueInterno } from "@/features/embarques/hooks/useEmbarqueInterno";
import { useContenedoresEmbarque } from "@/features/embarques/hooks/useContenedoresEmbarque";
import {
  monedasExtranjerasActivas,
  tieneContenedorOperativo,
} from "@/features/embarques/domain/pnlPresentacion";
import type {
  EmbarqueDetalleTabsProps,
  PnlView,
} from "./_sections/embarqueDetalleTabsTypes";
import { PnlViewSelector } from "./_sections/PnlViewSelector";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useGarantiasContenedor } from "@/features/embarques/hooks/useGarantiasContenedor";

const TabResumen = lazy(() => import("./TabResumen").then((m) => ({ default: m.TabResumen })));
const TabDocumentos = lazy(() => import("./_sections/DocumentosDetalleContenido"));
const TabFacturasEntrantes = lazy(() => import("./TabFacturasEntrantes").then((m) => ({ default: m.TabFacturasEntrantes })));
const TabCostos = lazy(() => import("./TabCostos").then((m) => ({ default: m.TabCostos })));
const TabFacturacionEmbarque = lazy(() => import("./TabFacturacionEmbarque").then((m) => ({ default: m.TabFacturacionEmbarque })));
const TabNotas = lazy(() => import("./TabNotas").then((m) => ({ default: m.TabNotas })));
const TabTracking = lazy(() => import("./TabTracking").then((m) => ({ default: m.TabTracking })));
const TabConciliacion = lazy(() => import("./TabConciliacion").then((m) => ({ default: m.TabConciliacion })));
const TabPnl = lazy(() => import("./TabPnl").then((m) => ({ default: m.TabPnl })));
const TabPnlContenedor = lazy(() => import("./TabPnlContenedor").then((m) => ({ default: m.TabPnlContenedor })));
const TabSeguros = lazy(() => import("./TabSeguros").then((m) => ({ default: m.TabSeguros })));
const TabCierre = lazy(() => import("./TabCierre").then((m) => ({ default: m.TabCierre })));
const GarantiasDemorasContenido = lazy(() => import("./_sections/GarantiasDemorasContenido").then((m) => ({ default: m.GarantiasDemorasContenido })));

function CargaDetalleTab({ query, children }: {
  query: ReturnType<typeof useEmbarqueDetalleTabsData>["query"];
  children: ReactNode;
}) {
  return (
    <CargaGuard
      isLoading={query?.isLoading}
      isError={query?.isError}
      onRetry={query ? () => void query.refetch() : undefined}
      errorTitle="No pudimos cargar esta pestaña"
    >
      {query?.isLoading ? <ListSkeleton /> : (
        <Suspense fallback={<ListSkeleton />}>{children}</Suspense>
      )}
    </CargaGuard>
  );
}

function useOpcionesContenedor(embarqueId: string, esMaritimo: boolean, activeTab: string) {
  const necesitaContenedores = !esMaritimo || activeTab === "pnl";
  const { data: contenedores = [] } = useContenedoresEmbarque(necesitaContenedores ? embarqueId : undefined);
  const { data: garantias = [] } = useGarantiasContenedor(esMaritimo ? undefined : embarqueId);
  return {
    mostrarGarantias: esMaritimo || contenedores.length > 0 || garantias.length > 0,
    permitePnlContenedor: tieneContenedorOperativo(contenedores),
  };
}

export function EmbarqueDetalleTabs({
  embarque, embarqueId, activeTab, setActiveTab, estadoVisual, canEdit,
  notaBorrador, onNotaBorradorChange, notaEnviando, onEnviarNota,
}: EmbarqueDetalleTabsProps) {
  const [pnlView, setPnlView] = useState<PnlView>("global");
  // B1 (v13.823.395): «Cargar costos» exige la capacidad estrecha, no el
  // `canEdit` genérico que también cubre documentos y tracking.
  const { canEditCostosEmbarque } = usePermissions();
  const esMaritimo = embarque.modo === "Marítimo";
  const { conceptosVenta, conceptosCosto, documentos, notas, facturas, financials, query } =
    useEmbarqueDetalleTabsData(embarque, activeTab);
  const { mostrarGarantias, permitePnlContenedor } = useOpcionesContenedor(embarqueId, esMaritimo, activeTab);
  const monedasExtranjeras = useMemo(
    () => monedasExtranjerasActivas(conceptosVenta, conceptosCosto),
    [conceptosVenta, conceptosCosto],
  );
  // `created_by_email` no es legible en la tabla `embarques`: viene de la vista
  // interna (staff), no de la fila de detalle.
  const { data: interno } = useEmbarqueInterno(activeTab === "notas" ? embarqueId : undefined);


  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      {/*
        Orden por flujo (v13.66.15):
          Operación: Resumen · Tracking · Documentos
          Finanzas:  Costos · Garantías y Demoras · Seguros · P&L · Facturación · Conciliación
          Cierre:    Cierre
          Bitácora:  Notas y actividad
      */}
      {/* v13.139.18 (F-04 auditoría 3): 11 tabs desbordaban a 2ª línea con
          flex-wrap. Cambiamos a scroll horizontal nativo con scrollbar fino
          para mantener todas las tabs en una sola fila sin partir el header.
          v13.823.26: la affordance de scroll (degradados + flechas) vive en
          `EmbarqueDetalleTabsBar` para mantener este archivo enfocado en el
          contenido de cada pestaña. */}
      <EmbarqueDetalleTabsBar mostrarGarantias={mostrarGarantias} soloHistorico={!esMaritimo} />

      {estadoVisual === "Borrador" && <AlertaBorrador etd={embarque.etd ?? null} />}

      <CargaDetalleTab query={query}>
        <TabsContent value="resumen" className="space-y-6">
          <TabResumen embarque={embarque} />
        </TabsContent>

        <TabsContent value="tracking">
          <TabTracking embarqueId={embarqueId} embarque={embarque} />
        </TabsContent>

        <TabsContent value="documentos">
          <TabDocumentos embarque={embarque} documentos={documentos} canEdit={canEdit} />
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
            montosSinTipoCambio={financials.montosSinTipoCambio}
            tipoCambioUsd={embarque.tipo_cambio_usd}
            tipoCambioEur={embarque.tipo_cambio_eur}
            monedasExtranjeras={monedasExtranjeras}
            embarqueId={embarqueId}
            canEditCostos={canEditCostosEmbarque}
          />
          <Separator />
          <TabFacturasEntrantes embarqueId={embarqueId} canEdit={canEdit}
            cerrado={embarque.estado === "Cerrado"} />
        </TabsContent>

        {/* Garantías y Demoras fusionadas (v13.66.15): mismo dominio (free time / depósito por contenedor). */}
        <TabsContent value="garantias" className="space-y-6">
          <GarantiasDemorasContenido embarqueId={embarqueId} esMaritimo={esMaritimo}
            mostrar={mostrarGarantias} canEdit={canEdit} fechaLlegada={embarque.fecha_llegada_real ?? null} />
        </TabsContent>

        <TabsContent value="seguros">
          <TabSeguros embarqueId={embarqueId} canEdit={canEdit}
            tipoCambioUsd={embarque.tipo_cambio_usd} tipoCambioEur={embarque.tipo_cambio_eur} />
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
            : <TabPnlContenedor embarqueId={embarqueId} expediente={embarque.expediente ?? ""} conceptosVenta={conceptosVenta} conceptosCosto={conceptosCosto} />}
        </TabsContent>

        <TabsContent value="cierre" className="space-y-6">
          <TabCierre
            embarqueId={embarqueId}
            estatus={embarque.estado ?? ""}
            modo={embarque.modo}
            expediente={embarque.expediente || ""}
            docsRequeridos={documentos.filter((d) => d.estado !== "No aplica").length}
          />
        </TabsContent>

        <TabsContent value="notas">
          <TabNotas
            texto={notaBorrador}
            onTextoChange={onNotaBorradorChange}
            enviando={notaEnviando}
            onEnviar={onEnviarNota}
            notas={notas}
            embarqueId={embarqueId}
            expediente={embarque.expediente}
            creadoPor={interno?.created_by_email ?? null}
            creadoEn={embarque.created_at}
          />
        </TabsContent>
      </CargaDetalleTab>
    </Tabs>
  );
}
