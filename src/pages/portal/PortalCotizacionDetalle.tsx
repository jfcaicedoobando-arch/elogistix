import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle2, XCircle, Info, MessageSquare } from "lucide-react";
import { usePortalCotizacion } from "@/hooks/usePortalData";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import SeccionMercanciaCotizacionDetalle from "@/components/cotizacion/SeccionMercanciaCotizacionDetalle";
import TablaConceptosGenerico from "@/components/cotizacion/TablaConceptosGenerico";
import ResumenTotalesCotizacion from "@/components/cotizacion/ResumenTotalesCotizacion";
import { usePortalCotizacionDetalle } from "@/hooks/usePortalCotizacionDetalle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { getEstadoColor } from "@/lib/uiMappings";
import type { Tables } from "@/integrations/supabase/types";
import { useResponderCotizacion } from "@/hooks/usePortalCotizacionMutations";

export default function PortalCotizacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: cot, isLoading } = usePortalCotizacion(id);
  const tasaIva = useTasaIVA();
  const { toast } = useToast();

  const [confirmAction, setConfirmAction] = useState<"Aceptada" | "Rechazada" | null>(null);
  const [comentario, setComentario] = useState("");
  const responderMutation = useResponderCotizacion(id ?? "");

  const handleResponder = async () => {
    if (!confirmAction || !id) return;
    responderMutation.mutate(
      { respuesta: confirmAction, comentario },
      {
        onSuccess: () => {
          toast({
            title: confirmAction === "Aceptada"
              ? "Cotización aceptada exitosamente"
              : "Cotización rechazada",
          });
          setConfirmAction(null);
          setComentario("");
        },
        onError: (err: unknown) => {
          toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
          setConfirmAction(null);
          setComentario("");
        },
      }
    )
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!cot) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cotización no encontrada.</p>
        <Button variant="link" onClick={() => navigate("/portal/cotizaciones")}>
          Volver a cotizaciones
        </Button>
      </div>
    );
  }

  const conceptos: ConceptoVentaCotizacion[] = Array.isArray(cot.conceptos_venta)
    ? (cot.conceptos_venta as unknown as ConceptoVentaCotizacion[])
    : [];

  const conceptosUSD = conceptos.filter((c) => c.moneda === "USD");
  const conceptosMXN = conceptos.filter((c) => c.moneda === "MXN");

  const totalUSD = conceptosUSD.reduce((s, c) => s + (c.total || 0), 0);
  const subtotalMXN = conceptosMXN.reduce(
    (s, c) => s + calcularSubtotal(c.cantidad, c.precio_unitario),
    0
  );
  const ivaMXN = conceptosMXN.reduce(
    (s, c) => s + calcularIVA(calcularSubtotal(c.cantidad, c.precio_unitario), tasaIva),
    0
  );
  const totalMXN = subtotalMXN + ivaMXN;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/portal/cotizaciones")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{cot.folio}</h1>
            <Badge className={getEstadoColor(cot.estado)}>
              {cot.estado}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{cot.cliente_nombre}</p>
        </div>

        {/* Botones de acción para estado Enviada */}
        {cot.estado === "Enviada" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmAction("Rechazada")}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rechazar
            </Button>
            <Button
              className="bg-success text-success-foreground hover:bg-success/90"
              onClick={() => setConfirmAction("Aceptada")}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aceptar Cotización
            </Button>
          </div>
        )}
      </div>

      {/* Banner informativo */}
      {cot.estado === "Aceptada" && (
        <Alert className="border-success/50 bg-success/10">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertDescription className="text-success">
            <p>Esta cotización fue aceptada. El equipo procederá con la operación.</p>
            {(cot as Tables<'cotizaciones'>).comentario_cliente && (
              <p className="mt-2 flex items-start gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="italic">"{(cot as Tables<'cotizaciones'>).comentario_cliente}"</span>
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
      {cot.estado === "Rechazada" && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <XCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">
            <p>Esta cotización fue rechazada.</p>
            {(cot as Tables<'cotizaciones'>).comentario_cliente && (
              <p className="mt-2 flex items-start gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="italic">"{(cot as Tables<'cotizaciones'>).comentario_cliente}"</span>
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
      {cot.estado === "Enviada" && (
        <Alert className="border-info/50 bg-info/10">
          <Info className="h-4 w-4 text-info" />
          <AlertDescription className="text-info">
            Esta cotización está pendiente de tu respuesta. Puedes aceptarla o rechazarla.
          </AlertDescription>
        </Alert>
      )}

      {/* Datos generales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos Generales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Modo</span>
              <p className="font-medium">{cot.modo}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Tipo</span>
              <p className="font-medium">{cot.tipo}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Incoterm</span>
              <p className="font-medium">{cot.incoterm}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Moneda</span>
              <p className="font-medium">{cot.moneda}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Origen</span>
              <p className="font-medium">{cot.origen || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Destino</span>
              <p className="font-medium">{cot.destino || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vigencia</span>
              <p className="font-medium">{cot.fecha_vigencia || "—"}</p>
            </div>
            {cot.tiempo_transito_dias != null && (
              <div>
                <span className="text-muted-foreground">Tiempo de Tránsito</span>
                <p className="font-medium">{cot.tiempo_transito_dias} días</p>
              </div>
            )}
            {cot.ruta_texto && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Ruta</span>
                <p className="font-medium">{cot.ruta_texto}</p>
              </div>
            )}
            {cot.frecuencia && (
              <div>
                <span className="text-muted-foreground">Frecuencia</span>
                <p className="font-medium">{cot.frecuencia}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mercancía */}
      <SeccionMercanciaCotizacionDetalle cotizacion={cot} />

      {/* Conceptos USD */}
      {conceptosUSD.length > 0 && (
        <TablaConceptosGenerico moneda="USD" conceptos={conceptosUSD} total={totalUSD} />
      )}

      {/* Conceptos MXN */}
      {conceptosMXN.length > 0 && (
        <TablaConceptosGenerico
          moneda="MXN"
          conceptos={conceptosMXN}
          subtotal={subtotalMXN}
          iva={ivaMXN}
          total={totalMXN}
        />
      )}

      {/* Resumen */}
      <ResumenTotalesCotizacion totalUSD={totalUSD} totalMXN={totalMXN} />

      {/* Notas */}
      {cot.notas && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{cot.notas}</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog de confirmación */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) { setConfirmAction(null); setComentario(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "Aceptada" ? "¿Aceptar esta cotización?" : "¿Rechazar esta cotización?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "Aceptada"
                ? "Al aceptar, el equipo de operaciones será notificado para proceder con el embarque. Esta acción no se puede deshacer."
                : "Al rechazar, la cotización quedará cerrada. Si necesitas cambios, contacta al equipo de operaciones."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={confirmAction === "Aceptada" ? "¿Algún comentario? (opcional)" : "¿Motivo del rechazo? (opcional)"}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="min-h-[80px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={responderMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResponder}
              disabled={responderMutation.isPending}
              className={confirmAction === "Rechazada" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {responderMutation.isPending ? "Procesando..." : confirmAction === "Aceptada" ? "Sí, aceptar" : "Sí, rechazar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
