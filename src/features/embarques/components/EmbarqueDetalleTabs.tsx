import { useState, type ComponentProps } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FileEdit } from "lucide-react";
import { TabResumen } from "@/features/embarques/components/TabResumen";
import { TabDocumentos } from "@/features/embarques/components/TabDocumentos";
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


// Tipos derivados de los hijos para no duplicar contratos ni recurrir a `any`.
type ResumenProps = ComponentProps<typeof TabResumen>;
type DocsProps = ComponentProps<typeof TabDocumentos>;
type CostosProps = ComponentProps<typeof TabCostos>;
type FacturacionProps = ComponentProps<typeof TabFacturacion>;
type NotasProps = ComponentProps<typeof TabNotas>;
type TrackingProps = ComponentProps<typeof TabTracking>;

type DocHandlers = Pick<
  DocsProps,
  "uploadingDocId" | "downloadingDocId" | "deletingDocId" | "togglingNoAplicaDocId"
  | "onUpload" | "onDownload" | "onDelete" | "onToggleNoAplica"
>;

interface Financials {
  totalVenta: number;
  totalCosto: number;
  utilidad: number;
  margen: number;
}

// El embarque debe satisfacer simultáneamente los contratos de TabResumen,
// TabFacturacion y TabTracking, además de exponer los campos que esta vista
// consume directamente (expediente, created_by_email, created_at).
type EmbarqueProp = ResumenProps["embarque"]
  & FacturacionProps["embarque"]
  & TrackingProps["embarque"]
  & {
    expediente: string;
    modo: string;
    created_by_email?: string | null;
    created_at: string;
  };

interface Props {
  embarque: EmbarqueProp;
  embarqueId: string;
  activeTab: string;
  setActiveTab: (t: string) => void;
  estadoVisual: string;
  canEdit: boolean;
  documentos: DocsProps["documentos"];
  conceptosVenta: CostosProps["conceptosVenta"];
  conceptosCosto: CostosProps["conceptosCosto"];
  facturas: FacturacionProps["facturas"];
  notas: NotasProps["notas"];
  financials: Financials;
  docHandlers: DocHandlers;
}

type PnlView = "global" | "contenedor";

export function EmbarqueDetalleTabs({
  embarque, embarqueId, activeTab, setActiveTab, estadoVisual, canEdit,
  documentos, conceptosVenta, conceptosCosto, facturas, notas,
  financials, docHandlers,
}: Props) {
  const [pnlView, setPnlView] = useState<PnlView>("global");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      {/*
        Orden por flujo (v13.66.15):
          Operación: Resumen · Tracking · Documentos
          Finanzas:  Costos · Garantías y Demoras · Seguros · P&L · Facturación · Conciliación
          Cierre:    Cierre
          Bitácora:  Notas y Actividad
      */}
      <TabsList className="gap-1 flex-wrap h-auto">
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="tracking">Tracking</TabsTrigger>
        <TabsTrigger value="documentos">Documentos</TabsTrigger>
        <TabsTrigger value="costos">Costos</TabsTrigger>
        <TabsTrigger value="garantias">Demoras y Garantías</TabsTrigger>
        <TabsTrigger value="seguros">Seguros</TabsTrigger>
        <TabsTrigger value="facturacion">Facturación</TabsTrigger>
        <TabsTrigger value="conciliacion">Conciliación</TabsTrigger>
        <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
        <TabsTrigger value="cierre">Cierre</TabsTrigger>
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

      <TabsContent value="costos" className="space-y-6">
        <TabCostos
          conceptosVenta={conceptosVenta}
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
          : <TabPnlContenedor embarqueId={embarqueId} expediente={embarque.expediente} />}
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
