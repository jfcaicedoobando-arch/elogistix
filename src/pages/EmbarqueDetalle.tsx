import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Printer, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/formatters";
import { getEstadoColor, getModoIcon } from "@/lib/helpers";
import { usePermissions } from "@/hooks/usePermissions";
import { uploadFile, getSignedUrl } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { ESTADO_TIMELINE } from "@/data/embarqueConstants";
import {
  useEmbarque,
  useEmbarqueConceptosVenta,
  useEmbarqueConceptosCosto,
  useEmbarqueDocumentos,
  useEmbarqueNotas,
  useEmbarqueFacturas,
  useAvanzarEstadoEmbarque,
  useEmbarquesHermanos,
} from "@/hooks/useEmbarques";
import { TabResumen } from "@/components/embarque/TabResumen";
import { TabDocumentos } from "@/components/embarque/TabDocumentos";
import { TabCostos } from "@/components/embarque/TabCostos";
import { TabFacturacion } from "@/components/embarque/TabFacturacion";
import { TabNotas } from "@/components/embarque/TabNotas";

export default function EmbarqueDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const registrarActividad = useRegistrarActividad();
  const { data: embarque, isLoading } = useEmbarque(id);
  const { data: conceptosVenta = [] } = useEmbarqueConceptosVenta(id);
  const { data: conceptosCosto = [] } = useEmbarqueConceptosCosto(id);
  const { data: documentos = [], refetch: refetchDocs } = useEmbarqueDocumentos(id);
  const { data: notas = [] } = useEmbarqueNotas(id);
  const { data: facturas = [] } = useEmbarqueFacturas(id);
  const avanzarEstado = useAvanzarEstadoEmbarque();
  const { data: embarquesHermanos = [] } = useEmbarquesHermanos(
    (embarque as any)?.referencia_operacion,
    id
  );

  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const handleUpload = async (docId: string, file: File) => {
    if (!id) return;
    setUploadingDocId(docId);
    try {
      const path = `embarques/${id}/${docId}/${file.name}`;
      await uploadFile(path, file);
      await supabase.from("documentos_embarque").update({ archivo: path, estado: "Recibido" as any }).eq("id", docId);
      registrarActividad.mutate({
        accion: 'subir_documento',
        modulo: 'embarques',
        entidad_id: id,
        entidad_nombre: embarque?.expediente ?? '',
        detalles: { documento: file.name },
      });
      toast({ title: "Archivo subido correctamente" });
      refetchDocs();
    } catch (err: any) {
      toast({ title: "Error al subir archivo", description: err.message, variant: "destructive" });
    } finally {
      setUploadingDocId(null);
    }
  };

  const handleDownload = async (rutaArchivo: string, docId: string) => {
    setDownloadingDocId(docId);
    try {
      const url = await getSignedUrl(rutaArchivo);
      window.open(url, "_blank");
    } catch (err: any) {
      toast({ title: "Error al descargar", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingDocId(null);
    }
  };

  const getSiguienteEstado = (estadoActual: string) => {
    const idx = ESTADO_TIMELINE.indexOf(estadoActual as any);
    if (idx < 0 || idx >= ESTADO_TIMELINE.length - 1) return null;
    return ESTADO_TIMELINE[idx + 1];
  };

  const handleAvanzarEstado = async () => {
    if (!embarque || !id) return;
    const siguiente = getSiguienteEstado(embarque.estado);
    if (!siguiente) return;
    try {
      await avanzarEstado.mutateAsync({
        embarqueId: id,
        nuevoEstado: siguiente,
        usuarioEmail: user?.email ?? '',
      });
      registrarActividad.mutate({
        accion: 'cambiar_estado',
        modulo: 'embarques',
        entidad_id: id,
        entidad_nombre: embarque.expediente,
        detalles: { estado_anterior: embarque.estado, estado_nuevo: siguiente },
      });
      toast({ title: `Estado actualizado a "${siguiente}"` });
    } catch (err: any) {
      toast({ title: "Error al cambiar estado", description: err.message, variant: "destructive" });
    }
  };

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

  const tipoCambioUSD = Number(embarque.tipo_cambio_usd) || 1;
  const tipoCambioEUR = Number(embarque.tipo_cambio_eur) || 1;

  const totalVenta = conceptosVenta.reduce((sum, concepto) => {
    const totalConcepto = Number(concepto.total);
    if (concepto.moneda === 'USD') return sum + totalConcepto * tipoCambioUSD;
    if (concepto.moneda === 'EUR') return sum + totalConcepto * tipoCambioEUR;
    return sum + totalConcepto;
  }, 0);
  const totalCosto = conceptosCosto.reduce((sum, concepto) => {
    const montoConcepto = Number(concepto.monto);
    if (concepto.moneda === 'USD') return sum + montoConcepto * tipoCambioUSD;
    if (concepto.moneda === 'EUR') return sum + montoConcepto * tipoCambioEUR;
    return sum + montoConcepto;
  }, 0);
  const utilidad = totalVenta - totalCosto;
  const margen = totalVenta > 0 ? (utilidad / totalVenta) * 100 : 0;

  const siguienteEstado = getSiguienteEstado(embarque.estado);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/embarques")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{embarque.expediente}</h1>
            <Badge className={getEstadoColor(embarque.estado)}>{embarque.estado}</Badge>
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
                    ¿Estás seguro de cambiar el estado de <strong>{embarque.estado}</strong> a <strong>{siguienteEstado}</strong>? Esta acción quedará registrada en la bitácora.
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
          <Button variant="outline" size="sm"><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
        </div>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList className="gap-1">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="costos">Costos</TabsTrigger>
          <TabsTrigger value="facturacion">Facturación</TabsTrigger>
          <TabsTrigger value="notas">Notas y Actividad</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-6">
          <TabResumen embarque={embarque} embarquesHermanos={embarquesHermanos} />
        </TabsContent>

        <TabsContent value="documentos">
          <TabDocumentos
            documentos={documentos}
            canEdit={canEdit}
            uploadingDocId={uploadingDocId}
            downloadingDocId={downloadingDocId}
            onUpload={handleUpload}
            onDownload={handleDownload}
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

        <TabsContent value="notas">
          <TabNotas notas={notas} embarqueId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
