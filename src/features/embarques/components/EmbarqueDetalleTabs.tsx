import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileEdit } from "lucide-react";
import { TabResumen } from "@/features/embarques/components/TabResumen";
import { TabDocumentos } from "@/features/embarques/components/TabDocumentos";
import { TabCostos } from "@/features/embarques/components/TabCostos";
import { TabFacturacion } from "@/features/embarques/components/TabFacturacion";
import { TabNotas } from "@/features/embarques/components/TabNotas";
import { TabTracking } from "@/features/embarques/components/TabTracking";
import { TabGarantias } from "@/features/embarques/components/TabGarantias";
import { TabConciliacion } from "@/features/embarques/components/TabConciliacion";

interface DocHandlers {
  uploadingDocId: string | null;
  downloadingDocId: string | null;
  deletingDocId: string | null;
  togglingNoAplicaDocId: string | null;
  onUpload: (docId: string, file: File) => void;
  onDownload: (docId: string, archivo: string | null | undefined, nombre: string) => void;
  onDelete: (docId: string, archivo: string | null | undefined, nombre: string) => void;
  onToggleNoAplica: (docId: string, nombre: string, currentEstado: string) => void;
}

interface Financials {
  totalVenta: number;
  totalCosto: number;
  utilidad: number;
  margen: number;
}

interface Props {
  embarque: {
    expediente: string;
    modo: string;
    created_by_email?: string | null;
    created_at: string;
  };
  embarqueId: string;
  activeTab: string;
  setActiveTab: (t: string) => void;
  estadoVisual: string;
  canEdit: boolean;
  documentos: unknown[];
  conceptosVenta: unknown[];
  conceptosCosto: unknown[];
  facturas: unknown[];
  notas: unknown[];
  financials: Financials;
  docHandlers: DocHandlers;
}

export function EmbarqueDetalleTabs({
  embarque, embarqueId, activeTab, setActiveTab, estadoVisual, canEdit,
  documentos, conceptosVenta, conceptosCosto, facturas, notas,
  financials, docHandlers,
}: Props) {
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="gap-1">
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="documentos">Documentos</TabsTrigger>
        <TabsTrigger value="costos">Costos</TabsTrigger>
        <TabsTrigger value="conciliacion">Conciliación</TabsTrigger>
        <TabsTrigger value="facturacion">Facturación</TabsTrigger>
        <TabsTrigger value="garantias">Garantías</TabsTrigger>
        <TabsTrigger value="tracking">Tracking</TabsTrigger>
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
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <TabResumen embarque={embarque as any} />
      </TabsContent>

      <TabsContent value="documentos">
        <TabDocumentos
          embarqueId={embarqueId}
          modo={embarque.modo}
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          documentos={documentos as any}
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
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          conceptosVenta={conceptosVenta as any}
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          conceptosCosto={conceptosCosto as any}
          totalVenta={financials.totalVenta}
          totalCosto={financials.totalCosto}
          utilidad={financials.utilidad}
          margen={financials.margen}
          embarqueId={embarqueId}
          canEdit={canEdit}
        />
      </TabsContent>

      <TabsContent value="conciliacion" className="space-y-6">
        <TabConciliacion embarqueId={embarqueId} />
      </TabsContent>

      <TabsContent value="facturacion">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <TabFacturacion facturas={facturas as any} canEdit={canEdit} embarque={embarque as any} />
      </TabsContent>

      <TabsContent value="garantias">
        <TabGarantias embarqueId={embarqueId} canEdit={canEdit} />
      </TabsContent>

      <TabsContent value="tracking">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <TabTracking embarqueId={embarqueId} embarque={embarque as any} notas={notas as any} />
      </TabsContent>

      <TabsContent value="notas">
        <TabNotas
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          notas={notas as any}
          embarqueId={embarqueId}
          expediente={embarque.expediente}
          creadoPor={embarque.created_by_email ?? null}
          creadoEn={embarque.created_at}
        />
      </TabsContent>
    </Tabs>
  );
}
