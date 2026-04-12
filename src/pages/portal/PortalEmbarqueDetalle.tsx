import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Clock, MapPin, Ship, FileCheck, FileX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePortalEmbarque, usePortalEventos, usePortalDocumentos } from "@/hooks/usePortalData";
import { getEstadoColor, getModoIcon } from "@/lib/uiMappings";
import { calcularEstadoEmbarque } from "@/lib/embarqueLogic";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/formatters";
import { parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo } from "react";

const ICONO_EVENTO: Record<string, string> = {
  Zarpe: "🚢", Transbordo: "🔄", "Arribo a Puerto": "⚓", Descarga: "📦",
  "Despacho Aduanal": "🛃", Liberación: "✅", "En Ruta Terrestre": "🚛",
  Entrega: "🏁", Demora: "⚠️", Inspección: "🔍", Otro: "📝",
};

const DOC_ESTADO_ICON: Record<string, { icon: typeof FileCheck; color: string }> = {
  Pendiente: { icon: FileX, color: "text-amber-500" },
  Recibido: { icon: FileCheck, color: "text-accent" },
  Validado: { icon: FileCheck, color: "text-green-600" },
};

// Progress steps for visual tracker
const PROGRESS_STEPS = [
  { key: "Confirmado", label: "Confirmado", icon: "📋" },
  { key: "En Tránsito", label: "En Tránsito", icon: "🚢" },
  { key: "Arribo", label: "Arribo", icon: "⚓" },
  { key: "En Aduana", label: "Aduana", icon: "🛃" },
  { key: "Entregado", label: "Entregado", icon: "🏁" },
];

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
      const filename = archivo.split("/").pop() || "documento";
      try {
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(data.signedUrl, "_blank");
      }
    } catch {
      toast({ title: "Error al descargar", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  // Determine current step index for progress tracker
  const currentStepIndex = useMemo(() => {
    if (!embarque) return -1;
    const estado = calcularEstadoEmbarque(embarque.modo, embarque.tipo, embarque.etd, embarque.eta, embarque.estado);
    const idx = PROGRESS_STEPS.findIndex((s) => s.key === estado);
    if (estado === "Cerrado" || estado === "EIR") return PROGRESS_STEPS.length;
    return idx >= 0 ? idx : 0;
  }, [embarque]);

  // Days until ETA
  const diasParaEta = useMemo(() => {
    if (!embarque?.eta) return null;
    try {
      return differenceInDays(parseISO(embarque.eta), new Date());
    } catch { return null; }
  }, [embarque]);

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!embarque) {
    return (
      <div className="text-center py-20">
        <Ship className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground font-medium">Embarque no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/portal/embarques")}>Volver</Button>
      </div>
    );
  }

  const estadoVisual = calcularEstadoEmbarque(embarque.modo, embarque.tipo, embarque.etd, embarque.eta, embarque.estado);
  const docsValidados = documentos.filter((d) => d.estado === "Validado").length;
  const docsTotal = documentos.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/portal/embarques")} className="mt-0.5">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{embarque.expediente}</h1>
            <Badge className={getEstadoColor(estadoVisual)}>{estadoVisual}</Badge>
            <span className="text-lg">{getModoIcon(embarque.modo)}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {embarque.tipo} • {embarque.modo} • {embarque.incoterm}
          </p>
        </div>
      </div>

      {/* Progress Tracker */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between relative">
            {/* Background line */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
            <div
              className="absolute top-5 left-0 h-0.5 bg-accent transition-all duration-500"
              style={{ width: `${Math.min(100, (currentStepIndex / (PROGRESS_STEPS.length - 1)) * 100)}%` }}
            />

            {PROGRESS_STEPS.map((step, i) => {
              const isCompleted = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step.key} className="flex flex-col items-center relative z-10 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border-2 transition-all ${
                      isCompleted
                        ? "bg-accent border-accent text-white"
                        : isCurrent
                        ? "bg-accent/10 border-accent text-accent ring-4 ring-accent/20"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {step.icon}
                  </div>
                  <span className={`text-[10px] mt-2 text-center font-medium ${
                    isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ETA countdown */}
          {diasParaEta !== null && diasParaEta > 0 && (
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Llegada estimada en <span className="font-bold text-accent">{diasParaEta} día{diasParaEta !== 1 ? "s" : ""}</span>
                {embarque.eta && (
                  <span> ({formatDate(embarque.eta, "dd 'de' MMMM")})</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground font-medium">Origen</p>
            <p className="text-xs font-semibold mt-0.5 truncate">{embarque.puerto_origen || embarque.aeropuerto_origen || embarque.ciudad_origen || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground font-medium">Destino</p>
            <p className="text-xs font-semibold mt-0.5 truncate">{embarque.puerto_destino || embarque.aeropuerto_destino || embarque.ciudad_destino || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground font-medium">ETD</p>
            <p className="text-xs font-semibold mt-0.5">{embarque.etd ? formatDate(embarque.etd) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground font-medium">ETA</p>
            <p className="text-xs font-semibold mt-0.5">{embarque.eta ? formatDate(embarque.eta) : "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="tracking" className="relative">
            Tracking
            {eventos.length > 0 && (
              <span className="ml-1.5 rounded-full bg-accent/10 text-accent text-[10px] px-1.5 font-bold">{eventos.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="documentos" className="relative">
            Documentos
            {docsTotal > 0 && (
              <span className="ml-1.5 rounded-full bg-accent/10 text-accent text-[10px] px-1.5 font-bold">{docsValidados}/{docsTotal}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Datos de Ruta</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Origen</dt>
                  <dd className="font-medium">{embarque.puerto_origen || embarque.aeropuerto_origen || embarque.ciudad_origen || "—"}</dd>
                  <dt className="text-muted-foreground">Destino</dt>
                  <dd className="font-medium">{embarque.puerto_destino || embarque.aeropuerto_destino || embarque.ciudad_destino || "—"}</dd>
                  <dt className="text-muted-foreground">ETD</dt>
                  <dd className="font-medium">{embarque.etd || "—"}</dd>
                  <dt className="text-muted-foreground">ETA</dt>
                  <dd className="font-medium">{embarque.eta || "—"}</dd>
                  {embarque.naviera && <>
                    <dt className="text-muted-foreground">Naviera</dt>
                    <dd className="font-medium">{embarque.naviera}</dd>
                  </>}
                  {embarque.aerolinea && <>
                    <dt className="text-muted-foreground">Aerolínea</dt>
                    <dd className="font-medium">{embarque.aerolinea}</dd>
                  </>}
                  {embarque.transportista && <>
                    <dt className="text-muted-foreground">Transportista</dt>
                    <dd className="font-medium">{embarque.transportista}</dd>
                  </>}
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Datos Generales</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Modo</dt>
                  <dd className="font-medium">{embarque.modo}</dd>
                  <dt className="text-muted-foreground">Tipo</dt>
                  <dd className="font-medium">{embarque.tipo}</dd>
                  <dt className="text-muted-foreground">Incoterm</dt>
                  <dd className="font-medium">{embarque.incoterm}</dd>
                  <dt className="text-muted-foreground">Mercancía</dt>
                  <dd className="font-medium">{embarque.descripcion_mercancia || "—"}</dd>
                  {embarque.contenedor && <>
                    <dt className="text-muted-foreground">Contenedor</dt>
                    <dd className="font-medium">{embarque.contenedor}</dd>
                  </>}
                  {embarque.bl_master && <>
                    <dt className="text-muted-foreground">BL Master</dt>
                    <dd className="font-medium">{embarque.bl_master}</dd>
                  </>}
                  {embarque.bl_house && <>
                    <dt className="text-muted-foreground">BL House</dt>
                    <dd className="font-medium">{embarque.bl_house}</dd>
                  </>}
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tracking">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Línea de Tiempo</CardTitle></CardHeader>
            <CardContent>
              {eventos.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No hay eventos registrados aún.</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-6">
                    {eventos.map((ev, i) => (
                      <div key={ev.id} className="relative pl-10">
                        <div className={`absolute left-2.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-background transition-colors ${
                          i === 0 ? "bg-accent ring-4 ring-accent/20" : "bg-muted-foreground/40"
                        }`} />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base">{ICONO_EVENTO[ev.tipo] ?? "📝"}</span>
                            <Badge variant="secondary" className="text-xs">{ev.tipo}</Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(ev.fecha, "dd MMM yyyy, HH:mm")}
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
              {documentos.length === 0 ? (
                <div className="text-center py-12">
                  <FileCheck className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No hay documentos disponibles.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-24 text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentos.map((doc) => {
                      const docInfo = DOC_ESTADO_ICON[doc.estado] || DOC_ESTADO_ICON.Pendiente;
                      const DocIcon = docInfo.icon;
                      return (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <DocIcon className={`h-4 w-4 ${docInfo.color}`} />
                              <span className="font-medium">{doc.nombre}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{doc.estado}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {doc.archivo ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={downloadingId === doc.id}
                                onClick={() => handleDownload(doc.archivo!, doc.id)}
                              >
                                {downloadingId === doc.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
