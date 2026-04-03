import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Printer, ChevronRight, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getEstadoColor, getModoIcon } from "@/lib/helpers";
import { usePermissions } from "@/hooks/usePermissions";
import { useState } from "react";
import {
  useEmbarque,
  useEmbarqueConceptosVenta,
  useEmbarqueConceptosCosto,
  useEmbarqueDocumentos,
  useEmbarqueNotas,
  useEmbarqueFacturas,
  calcularEstadoEmbarque,
} from "@/hooks/useEmbarques";
import { useEmbarqueFinancials } from "@/hooks/useEmbarqueFinancials";
import { useEmbarqueDetalleActions, getSiguienteEstado } from "@/hooks/useEmbarqueDetalleActions";
import { TabResumen } from "@/components/embarque/TabResumen";
import { TabDocumentos } from "@/components/embarque/TabDocumentos";
import { TabCostos } from "@/components/embarque/TabCostos";
import { TabFacturacion } from "@/components/embarque/TabFacturacion";
import { TabNotas } from "@/components/embarque/TabNotas";
import { TabTracking } from "@/components/embarque/TabTracking";
import DialogDuplicarEmbarque from "@/components/embarque/DialogDuplicarEmbarque";
import DialogEliminarEmbarque from "@/components/embarque/DialogEliminarEmbarque";

export default function EmbarqueDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { data: embarque, isLoading } = useEmbarque(id);
  const { data: conceptosVenta = [] } = useEmbarqueConceptosVenta(id);
  const { data: conceptosCosto = [] } = useEmbarqueConceptosCosto(id);
  const { data: documentos = [] } = useEmbarqueDocumentos(id);
  const { data: notas = [] } = useEmbarqueNotas(id);
  const { data: facturas = [] } = useEmbarqueFacturas(id);

  const [dialogDuplicarAbierto, setDialogDuplicarAbierto] = useState(false);
  const [dialogEliminarAbierto, setDialogEliminarAbierto] = useState(false);

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
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Embarque no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/embarques")}>Volver</Button>
      </div>
    );
  }

  const estadoVisual = calcularEstadoEmbarque(embarque.modo, embarque.tipo, embarque.etd, embarque.eta, embarque.estado);
  const siguienteEstado = getSiguienteEstado(estadoVisual);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/embarques")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{embarque.expediente}</h1>
            <Badge className={getEstadoColor(estadoVisual)}>{estadoVisual}</Badge>
            <span className="text-lg">{getModoIcon(embarque.modo)}</span>
          </div>
          <p className="text-sm text-muted-foreground">{embarque.cliente_nombre}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && siguienteEstado && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={avanzarEstado.isPending}>
                  <ChevronRight className="h-4 w-4 mr-1" />
                  Avanzar a {siguienteEstado}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar cambio de estado</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Estás seguro de cambiar el estado de <strong>{estadoVisual}</strong> a <strong>{siguienteEstado}</strong>? Esta acción quedará registrada en la bitácora.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleAvanzarEstado}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canEdit && <Button variant="outline" size="sm" onClick={() => navigate(`/embarques/${id}/editar`)}><Edit className="h-4 w-4 mr-1" /> Editar</Button>}
          {canEdit && <Button variant="outline" size="sm" onClick={() => setDialogDuplicarAbierto(true)}><Copy className="h-4 w-4 mr-1" /> Duplicar</Button>}
          {canEdit && (
            <Button variant="destructive" size="sm" onClick={() => setDialogEliminarAbierto(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          )}
          <Button variant="outline" size="sm"><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
        </div>
      </div>

      <DialogDuplicarEmbarque embarque={embarque} open={dialogDuplicarAbierto} onOpenChange={setDialogDuplicarAbierto} />
      <DialogEliminarEmbarque embarque={embarque} open={dialogEliminarAbierto} onOpenChange={setDialogEliminarAbierto} />

      <Tabs defaultValue="resumen">
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
          <TabFacturacion facturas={facturas} canEdit={canEdit} />
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
