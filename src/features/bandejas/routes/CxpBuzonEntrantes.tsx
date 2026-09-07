/**
 * Buzón CxP: facturas de proveedor entregadas por operación.
 *
 * Contabilidad revisa el archivo en la vista previa, captura la factura desde
 * el embarque y marca el documento como capturado o rechazado.
 *
 * v13.365.0 — Rediseño 1366×768: filas de una línea, toolbar de búsqueda y
 * filtros, KPIs accionables, vista previa lateral e historial por pestañas.
 */
import { useState } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabsParam } from "@/hooks/shared/useTabsParam";

/** Pestañas válidas del buzón (UX-04). */
const BUZON_TABS = ["pendientes", "capturadas", "rechazadas"] as const;
import { notifyError } from "@/lib/ui/appFeedback";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { type ChipBuzon } from "@/features/bandejas/domain/facturasEntrantesBuzon";
import { BuzonEntrantesKpis } from "@/features/bandejas/components/BuzonEntrantesKpis";

import {
  useCapturarFacturaEntrante,
  useFacturasEntrantesPendientes,
  useFacturasEntrantesPorEstado,
  useReactivarFacturaEntrante,
  useRechazarFacturaEntrante,
} from "@/features/cxp/hooks";
import { abrirFacturaEntrante, type FacturaEntranteRow } from "@/features/cxp/services";
import { FacturasEntrantesToolbar } from "@/features/bandejas/components/FacturasEntrantesToolbar";
import { FacturasEntrantesLista } from "@/features/bandejas/components/FacturasEntrantesLista";
import { useBuzonEntrantesFiltros } from "@/features/bandejas/hooks/useBuzonEntrantesFiltros";
import { BuzonEntrantesModales } from "@/features/bandejas/components/BuzonEntrantesModales";
import { useCapturaDesdeBuzon } from "@/features/bandejas/hooks/useCapturaDesdeBuzon";
import { useDocumentTitle } from "@/hooks/shared";

export default function CxpBuzonEntrantes() {
  useDocumentTitle("Buzón de compras");
  const { canCapturarFacturaProveedor } = usePermissions();
  const { data: pendientes = [], isLoading, isError, refetch } = useFacturasEntrantesPendientes();
  const rechazar = useRechazarFacturaEntrante();
  const capturar = useCapturarFacturaEntrante();
  const reactivar = useReactivarFacturaEntrante();
  // UX-04: pestaña persistida en ?tab=.
  const { activeTab: tab, setActiveTab: setTab } = useTabsParam(BUZON_TABS, "pendientes");
  const capturadas = useFacturasEntrantesPorEstado("capturada", tab === "capturadas");
  const rechazadas = useFacturasEntrantesPorEstado("rechazada", tab === "rechazadas");

  const [aRechazar, setARechazar] = useState<FacturaEntranteRow | null>(null);
  const [aCapturar, setACapturar] = useState<FacturaEntranteRow | null>(null);
  const [enPrevia, setEnPrevia] = useState<FacturaEntranteRow | null>(null);
  const [aCorregir, setACorregir] = useState<FacturaEntranteRow | null>(null);
  const captura = useCapturaDesdeBuzon();
  const { q, setQ, chip, setChip, orden, setOrden, resumen, filtradas } =
    useBuzonEntrantesFiltros(pendientes);

  const abrirArchivo = async (path: string, nombre: string) => {
    try {
      await abrirFacturaEntrante(path, nombre);
    } catch (error) {
      notifyError(undefined, { title: "No se pudo abrir el archivo", error, method: "ABRIR_FACTURA_ENTRANTE" });
    }
  };

  const aplicarChip = (siguiente: ChipBuzon) => {
    setTab("pendientes");
    setChip((actual) => (actual === siguiente ? "todos" : siguiente));
  };

  const acciones = {
    onVer: (row: FacturaEntranteRow) => setEnPrevia(row),
    onVerXml: (row: FacturaEntranteRow) =>
      void abrirArchivo(row.xml_path ?? row.archivo_path, row.xml_nombre ?? "cfdi.xml"),
    onCapturar: (row: FacturaEntranteRow) => { setEnPrevia(null); setACapturar(row); },
    onCrearFactura: (row: FacturaEntranteRow) => { setEnPrevia(null); void captura.iniciar(row); },
    onRechazar: (row: FacturaEntranteRow) => { setEnPrevia(null); setARechazar(row); },
    onCorregir: (row: FacturaEntranteRow) => { setEnPrevia(null); setACorregir(row); },
  };

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Buzón de facturas de proveedor"
        description="Documentos que operación recibió de los agentes y aún no se capturan en CxP."
      />

      <CargaGuard
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorTitle="No se pudo cargar el buzón de facturas"
        errorDescription="Revisa tu conexión y vuelve a intentar."
      >
      <BuzonEntrantesKpis
        total={resumen.total}
        atrasados={resumen.atrasados}
        sinXml={resumen.sinXml}
        chipActivo={chip}
        onChip={aplicarChip}
      />


      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pendientes">Pendientes ({resumen.total})</TabsTrigger>
          <TabsTrigger value="capturadas">Capturadas</TabsTrigger>
          <TabsTrigger value="rechazadas">Rechazadas</TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes" className="space-y-3">
          <FacturasEntrantesToolbar
            q={q}
            onQChange={setQ}
            chip={chip}
            onChipChange={setChip}
            orden={orden}
            onOrdenChange={setOrden}
            visibles={filtradas.length}
            total={resumen.total}
          />
          <FacturasEntrantesLista
            rows={filtradas}
            isLoading={isLoading}
            puedeProcesar={canCapturarFacturaProveedor}
            tituloVacio={resumen.total === 0 ? "Buzón al día" : "Sin resultados"}
            textoVacio={
              resumen.total === 0
                ? "No hay facturas de proveedor pendientes de capturar."
                : "Ningún documento coincide con la búsqueda o el filtro activo."
            }
            {...acciones}
          />
        </TabsContent>

        <TabsContent value="capturadas">
          <FacturasEntrantesLista
            rows={capturadas.data ?? []}
            isLoading={capturadas.isLoading}
            puedeProcesar={false}
            soloLectura
            tituloVacio="Sin documentos capturados"
            textoVacio="Aquí aparecerán los documentos que contabilidad ya capturó en CxP."
            {...acciones}
          />
        </TabsContent>

        <TabsContent value="rechazadas">
          <FacturasEntrantesLista
            rows={rechazadas.data ?? []}
            isLoading={rechazadas.isLoading}
            puedeProcesar={false}
            soloLectura
            tituloVacio="Sin documentos rechazados"
            textoVacio="Aquí aparecerán los documentos devueltos a operación, con su motivo."
            {...acciones}
            onReactivar={(row) => void reactivar.mutateAsync({ id: row.id, nombre: row.nombre_archivo })}
          />
        </TabsContent>
      </Tabs>

      <BuzonEntrantesModales
        puedeProcesar={canCapturarFacturaProveedor}
        acciones={acciones}
        enPrevia={enPrevia}
        onCerrarPrevia={() => setEnPrevia(null)}
        aCapturar={aCapturar}
        onCerrarCapturar={() => setACapturar(null)}
        capturarPendiente={capturar.isPending}
        onConfirmarCapturada={async (facturaId) => {
          if (!aCapturar) return;
          await capturar.mutateAsync({ id: aCapturar.id, facturaId });
          setACapturar(null);
        }}
        aRechazar={aRechazar}
        onCerrarRechazar={() => setARechazar(null)}
        rechazarPendiente={rechazar.isPending}
        onConfirmarRechazo={async (motivo) => {
          if (!aRechazar) return;
          await rechazar.mutateAsync({ id: aRechazar.id, motivo });
          setARechazar(null);
        }}
        entranteCaptura={captura.entrante}
        onCerrarCaptura={captura.cerrar}
        aCorregir={aCorregir}
        onCerrarCorregir={() => setACorregir(null)}
      />

      </CargaGuard>
    </PageContainer>
  );
}
