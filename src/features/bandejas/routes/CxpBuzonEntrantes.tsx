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
import { Clock, FileCode2, Inbox } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notifyError } from "@/lib/ui/appFeedback";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { DIAS_ATRASO_BUZON, type ChipBuzon } from "@/lib/domain/facturasEntrantesBuzon";

import {
  useCapturarFacturaEntrante,
  useFacturasEntrantesPendientes,
  useFacturasEntrantesPorEstado,
  useRechazarFacturaEntrante,
} from "@/features/cxp/hooks/useFacturasEntrantes";
import { abrirFacturaEntrante, type FacturaEntranteRow } from "@/features/cxp/services/facturasEntrantes";
import { RechazarFacturaEntranteDialog } from "@/features/bandejas/components/RechazarFacturaEntranteDialog";
import { MarcarCapturadaDialog } from "@/features/bandejas/components/MarcarCapturadaDialog";
import { FacturasEntrantesToolbar } from "@/features/bandejas/components/FacturasEntrantesToolbar";
import { FacturasEntrantesLista } from "@/features/bandejas/components/FacturasEntrantesLista";
import { PreviaFacturaEntranteSheet } from "@/features/bandejas/components/PreviaFacturaEntranteSheet";
import { useBuzonEntrantesFiltros } from "@/features/bandejas/hooks/useBuzonEntrantesFiltros";

export default function CxpBuzonEntrantes() {
  const { canCapturarFacturaProveedor } = usePermissions();
  const { data: pendientes = [], isLoading } = useFacturasEntrantesPendientes();
  const rechazar = useRechazarFacturaEntrante();
  const capturar = useCapturarFacturaEntrante();
  const [tab, setTab] = useState("pendientes");
  const capturadas = useFacturasEntrantesPorEstado("capturada", tab === "capturadas");
  const rechazadas = useFacturasEntrantesPorEstado("rechazada", tab === "rechazadas");

  const [aRechazar, setARechazar] = useState<FacturaEntranteRow | null>(null);
  const [aCapturar, setACapturar] = useState<FacturaEntranteRow | null>(null);
  const [enPrevia, setEnPrevia] = useState<FacturaEntranteRow | null>(null);
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
    onRechazar: (row: FacturaEntranteRow) => { setEnPrevia(null); setARechazar(row); },
  };

  return (
    <PageContainer>
      <PageHeader
        title="Buzón de facturas de proveedor"
        description="Documentos que operación recibió de los agentes y aún no se capturan en CxP."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Documentos por capturar"
          value={String(resumen.total)}
          icon={Inbox}
          onClick={() => aplicarChip("todos")}
        />
        <KpiCard
          label={`Con ${DIAS_ATRASO_BUZON} días o más`}
          value={String(resumen.atrasados)}
          icon={Clock}
          variant={resumen.atrasados > 0 ? "warning" : "default"}
          onClick={() => aplicarChip("atrasados")}
        />
        <KpiCard
          label="Sin XML del CFDI"
          value={String(resumen.sinXml)}
          icon={FileCode2}
          variant={resumen.sinXml > 0 ? "warning" : "default"}
          onClick={() => aplicarChip("sin_xml")}
        />
      </div>

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
          />
        </TabsContent>
      </Tabs>

      <PreviaFacturaEntranteSheet
        row={enPrevia}
        onOpenChange={(v) => { if (!v) setEnPrevia(null); }}
        puedeProcesar={canCapturarFacturaProveedor}
        onVerXml={acciones.onVerXml}
        onCapturar={acciones.onCapturar}
        onRechazar={acciones.onRechazar}
      />

      <MarcarCapturadaDialog
        open={Boolean(aCapturar)}
        onOpenChange={(v) => { if (!v) setACapturar(null); }}
        embarqueId={aCapturar?.embarque_id ?? null}
        expediente={aCapturar?.embarques?.expediente ?? null}
        nombreArchivo={aCapturar?.nombre_archivo ?? null}
        pendiente={capturar.isPending}
        onConfirm={async (facturaId) => {
          if (!aCapturar) return;
          await capturar.mutateAsync({ id: aCapturar.id, facturaId });
          setACapturar(null);
        }}
      />

      <RechazarFacturaEntranteDialog
        open={Boolean(aRechazar)}
        onOpenChange={(v) => { if (!v) setARechazar(null); }}
        pendiente={rechazar.isPending}
        onConfirm={async (motivo) => {
          if (!aRechazar) return;
          await rechazar.mutateAsync({ id: aRechazar.id, motivo });
          setARechazar(null);
        }}
      />
    </PageContainer>
  );
}
