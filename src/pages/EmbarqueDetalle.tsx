import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Printer, ChevronRight, Copy, Plus, Minus, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { getEstadoColor, getModoIcon } from "@/lib/helpers";
import { usePermissions } from "@/hooks/usePermissions";
import { uploadFile, getSignedUrl, deleteFile } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ESTADO_TIMELINE } from "@/data/embarqueConstants";
import { containerTypes } from "@/data/containerTypes";
import {
  useEmbarque,
  useEmbarqueConceptosVenta,
  useEmbarqueConceptosCosto,
  useEmbarqueDocumentos,
  useEmbarqueNotas,
  useEmbarqueFacturas,
  useAvanzarEstadoEmbarque,
  useDuplicarEmbarque,
  useEliminarEmbarque,
  calcularEstadoEmbarque,
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
  const { canEdit, isAdmin } = usePermissions();
  const registrarActividad = useRegistrarActividad();
  const { data: embarque, isLoading } = useEmbarque(id);
  const { data: conceptosVenta = [] } = useEmbarqueConceptosVenta(id);
  const { data: conceptosCosto = [] } = useEmbarqueConceptosCosto(id);
  const { data: documentos = [], refetch: refetchDocs } = useEmbarqueDocumentos(id);
  const { data: notas = [] } = useEmbarqueNotas(id);
  const { data: facturas = [] } = useEmbarqueFacturas(id);
  const avanzarEstado = useAvanzarEstadoEmbarque();

  const duplicarEmbarque = useDuplicarEmbarque();
  const eliminarEmbarque = useEliminarEmbarque();

  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [dialogDuplicarAbierto, setDialogDuplicarAbierto] = useState(false);
  const [confirmarEliminar1, setConfirmarEliminar1] = useState(false);
  const [confirmarEliminar2, setConfirmarEliminar2] = useState(false);

  interface FilaCopia {
    num_contenedor: string;
    tipo_contenedor: string;
    peso_kg: number;
    volumen_m3: number;
    piezas: number;
  }
  const [filaCopias, setFilaCopias] = useState<FilaCopia[]>([]);

  const abrirDialogDuplicar = () => {
    if (!embarque) return;
    const filaInicial: FilaCopia = {
      num_contenedor: '',
      tipo_contenedor: embarque.tipo_contenedor || '',
      peso_kg: Number(embarque.peso_kg) || 0,
      volumen_m3: Number(embarque.volumen_m3) || 0,
      piezas: embarque.piezas || 0,
    };
    setFilaCopias([filaInicial]);
    setDialogDuplicarAbierto(true);
  };

  const ajustarCantidadCopias = (delta: number) => {
    setFilaCopias(prev => {
      const nueva = [...prev];
      if (delta > 0 && nueva.length < 10) {
        nueva.push({
          num_contenedor: '',
          tipo_contenedor: embarque?.tipo_contenedor || '',
          peso_kg: Number(embarque?.peso_kg) || 0,
          volumen_m3: Number(embarque?.volumen_m3) || 0,
          piezas: embarque?.piezas || 0,
        });
      } else if (delta < 0 && nueva.length > 1) {
        nueva.pop();
      }
      return nueva;
    });
  };

  const actualizarFila = (index: number, campo: keyof FilaCopia, valor: any) => {
    setFilaCopias(prev => {
      const copia = [...prev];
      (copia[index] as any)[campo] = valor;
      return copia;
    });
  };

  const handleDuplicar = async () => {
    if (!embarque) return;
    try {
      const creados = await duplicarEmbarque.mutateAsync({
        embarqueOrigen: embarque,
        copias: filaCopias,
      });
      toast({
        title: `Se crearon ${creados.length} embarque(s)`,
        description: creados.map(c => c.expediente).join(', '),
      });
      setDialogDuplicarAbierto(false);
    } catch (err: any) {
      toast({ title: "Error al duplicar", description: err.message, variant: "destructive" });
    }
  };

  const handleEliminarEmbarque = async () => {
    if (!embarque || !id) return;
    try {
      await eliminarEmbarque.mutateAsync(id);
      registrarActividad.mutate({
        accion: 'eliminar',
        modulo: 'embarques',
        entidad_id: id,
        entidad_nombre: embarque.expediente,
        detalles: { cliente: embarque.cliente_nombre, modo: embarque.modo, tipo: embarque.tipo },
      });
      toast({ title: "Embarque eliminado", description: `${embarque.expediente} fue eliminado permanentemente.` });
      navigate("/embarques");
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    } finally {
      setConfirmarEliminar1(false);
      setConfirmarEliminar2(false);
    }
  };

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

  const handleDeleteDoc = async (doc: typeof documentos[number]) => {
    if (!id || !doc.archivo) return;
    setDeletingDocId(doc.id);
    try {
      await deleteFile(doc.archivo);
      await supabase.from("documentos_embarque").update({ archivo: null, estado: "Pendiente" as any }).eq("id", doc.id);
      registrarActividad.mutate({
        accion: 'eliminar_documento',
        modulo: 'embarques',
        entidad_id: id,
        entidad_nombre: embarque?.expediente ?? '',
        detalles: { documento: doc.nombre },
      });
      toast({ title: "Documento eliminado correctamente" });
      refetchDocs();
    } catch (err: any) {
      toast({ title: "Error al eliminar documento", description: err.message, variant: "destructive" });
    } finally {
      setDeletingDocId(null);
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
          {canEdit && <Button variant="outline" size="sm" onClick={abrirDialogDuplicar}><Copy className="h-4 w-4 mr-1" /> Duplicar</Button>}
          {isAdmin && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmarEliminar1(true)} disabled={eliminarEmbarque.isPending}>
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          )}
          <Button variant="outline" size="sm"><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
        </div>
      </div>

      {/* Dialog Duplicar Embarque */}
      <Dialog open={dialogDuplicarAbierto} onOpenChange={setDialogDuplicarAbierto}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Duplicar Embarque</DialogTitle>
            <DialogDescription>
              Desde {embarque.expediente} — BL: {embarque.bl_master || 'N/A'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">¿Cuántos contenedores adicionales?</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => ajustarCantidadCopias(-1)} disabled={filaCopias.length <= 1}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-semibold">{filaCopias.length}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => ajustarCantidadCopias(1)} disabled={filaCopias.length >= 10}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead># Contenedor</TableHead>
                  <TableHead>Tipo Contenedor</TableHead>
                  <TableHead>Peso (kg)</TableHead>
                  <TableHead>Volumen (m³)</TableHead>
                  <TableHead>Piezas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filaCopias.map((fila, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{i + 1}</TableCell>
                    <TableCell>
                      <Input
                        value={fila.num_contenedor}
                        onChange={e => actualizarFila(i, 'num_contenedor', e.target.value)}
                        placeholder="ABCD1234567"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={fila.tipo_contenedor} onValueChange={v => actualizarFila(i, 'tipo_contenedor', v)}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {containerTypes.map(ct => (
                            <SelectItem key={ct.code} value={ct.name}>{ct.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={fila.peso_kg}
                        onChange={e => actualizarFila(i, 'peso_kg', Number(e.target.value))}
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={fila.volumen_m3}
                        onChange={e => actualizarFila(i, 'volumen_m3', Number(e.target.value))}
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={fila.piezas}
                        onChange={e => actualizarFila(i, 'piezas', Number(e.target.value))}
                        className="h-8 w-20"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-start gap-2 rounded-md border border-accent bg-accent/20 p-3 text-sm text-accent-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Se copiará automáticamente: Cliente · BL Master · Naviera · Ruta · Fechas · Conceptos de venta · Costos internos</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDuplicarAbierto(false)}>Cancelar</Button>
            <Button onClick={handleDuplicar} disabled={duplicarEmbarque.isPending}>
              {duplicarEmbarque.isPending ? 'Creando...' : `Crear ${filaCopias.length} Embarque${filaCopias.length > 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* AlertDialog 1: Primera confirmación de eliminación */}
      <AlertDialog open={confirmarEliminar1} onOpenChange={setConfirmarEliminar1}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar embarque {embarque.expediente}?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar este embarque? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmarEliminar1(false);
                setConfirmarEliminar2(true);
              }}
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog 2: Segunda confirmación (irreversible) */}
      <AlertDialog open={confirmarEliminar2} onOpenChange={setConfirmarEliminar2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Confirmación final</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es <strong>irreversible</strong>. Se eliminarán permanentemente todos los documentos, costos, conceptos de venta, notas y facturas asociados al embarque <strong>{embarque.expediente}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleEliminarEmbarque}
              disabled={eliminarEmbarque.isPending}
            >
              {eliminarEmbarque.isPending ? 'Eliminando...' : 'Eliminar permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Tabs defaultValue="resumen">
        <TabsList className="gap-1">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="costos">Costos</TabsTrigger>
          <TabsTrigger value="facturacion">Facturación</TabsTrigger>
          <TabsTrigger value="notas">Notas y Actividad</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-6">
          <TabResumen embarque={embarque} />
        </TabsContent>

        <TabsContent value="documentos">
          <TabDocumentos
            documentos={documentos}
            canEdit={canEdit}
            uploadingDocId={uploadingDocId}
            downloadingDocId={downloadingDocId}
            deletingDocId={deletingDocId}
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

        <TabsContent value="notas">
          <TabNotas notas={notas} embarqueId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
