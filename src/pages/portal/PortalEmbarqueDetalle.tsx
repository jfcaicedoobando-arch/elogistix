import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePortalEmbarque, usePortalEventos, usePortalDocumentos } from "@/hooks/usePortalData";
import { getEstadoColor, getModoIcon } from "@/lib/helpers";
import { calcularEstadoEmbarque } from "@/hooks/useEmbarques";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, MapPin } from "lucide-react";
import { useState } from "react";

const ICONO_EVENTO: Record<string, string> = {
  Zarpe: "🚢", Transbordo: "🔄", "Arribo a Puerto": "⚓", Descarga: "📦",
  "Despacho Aduanal": "🛃", Liberación: "✅", "En Ruta Terrestre": "🚛",
  Entrega: "🏁", Demora: "⚠️", Inspección: "🔍", Otro: "📝",
};

export default function PortalEmbarqueDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: embarque, isLoading } = usePortalEmbarque(id);
  const { data: eventos = [] } = usePortalEventos(id);
  const { data: documentos = [] } = usePortalDocumentos(id);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (archivo: string, docId: string) => {
    setDownloadingId(docId);
    try {
      const { data, error } = await supabase.storage
        .from("documentos")
        .createSignedUrl(archivo, 300);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch {
      toast({ title: "Error al descargar", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!embarque) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Embarque no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/portal/embarques")}>Volver</Button>
      </div>
    );
  }

  const estadoVisual = calcularEstadoEmbarque(embarque.modo, embarque.tipo, embarque.etd, embarque.eta, embarque.estado);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/portal/embarques")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{embarque.expediente}</h1>
          <Badge className={getEstadoColor(estadoVisual)}>{estadoVisual}</Badge>
          <span className="text-lg">{getModoIcon(embarque.modo)}</span>
        </div>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Ruta</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>Origen:</strong> {embarque.puerto_origen || embarque.aeropuerto_origen || embarque.ciudad_origen || "—"}</p>
                <p><strong>Destino:</strong> {embarque.puerto_destino || embarque.aeropuerto_destino || embarque.ciudad_destino || "—"}</p>
                <p><strong>ETD:</strong> {embarque.etd || "—"}</p>
                <p><strong>ETA:</strong> {embarque.eta || "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Datos Generales</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>Modo:</strong> {embarque.modo}</p>
                <p><strong>Tipo:</strong> {embarque.tipo}</p>
                <p><strong>Incoterm:</strong> {embarque.incoterm}</p>
                <p><strong>Naviera/Aerolínea:</strong> {embarque.naviera || embarque.aerolinea || "—"}</p>
                <p><strong>Mercancía:</strong> {embarque.descripcion_mercancia || "—"}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tracking">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Línea de Tiempo</CardTitle></CardHeader>
            <CardContent>
              {eventos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay eventos registrados.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-6">
                    {eventos.map((ev, i) => (
                      <div key={ev.id} className="relative pl-10">
                        <div className={`absolute left-2.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-background ${i === 0 ? "bg-accent" : "bg-muted-foreground/40"}`} />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base">{ICONO_EVENTO[ev.tipo] ?? "📝"}</span>
                            <Badge variant="secondary" className="text-xs">{ev.tipo}</Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(ev.fecha), "dd MMM yyyy, HH:mm", { locale: es })}
                            </span>
                          </div>
                          {ev.descripcion && <p className="text-sm text-foreground">{ev.descripcion}</p>}
                          {ev.ubicacion && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {ev.ubicacion}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-24">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentos.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No hay documentos.</TableCell></TableRow>
                  ) : (
                    documentos.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.nombre}</TableCell>
                        <TableCell><Badge variant="secondary">{doc.estado}</Badge></TableCell>
                        <TableCell>
                          {doc.archivo && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={downloadingId === doc.id}
                              onClick={() => handleDownload(doc.archivo!, doc.id)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
