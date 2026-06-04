import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useCreateEventoEmbarque, TIPOS_EVENTO_TRACKING } from "@/hooks/embarque";
import { useActualizarFechaLlegadaReal } from "@/hooks/embarque/mutations/useActualizarFechaLlegadaReal";
import { ICONO_EVENTO } from "@/constants/embarqueConstants";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  eventoTrackingSchema,
  type EventoTrackingFormValues,
} from "@/lib/validation/mutationSchemas";
import { formatDate } from "@/lib/formatters";

type EventoFormValues = EventoTrackingFormValues;

/** Tipos que típicamente implican actualizar la fecha de llegada real. */
const TIPOS_QUE_ACTUALIZAN_LLEGADA = new Set(["Arribo a Puerto", "Entrega"]);

/** Sugerencia de tipo de evento según el estado actual del embarque. */
function tipoSugerido(estado: string | null | undefined): string {
  switch (estado) {
    case "En Tránsito":
      return "Arribo a Puerto";
    case "Arribo":
      return "Despacho Aduanal";
    case "En Aduana":
      return "Liberación";
    case "Confirmado":
    case "En Proceso":
      return "Zarpe";
    default:
      return "";
  }
}

const defaultEventoValues = (estado?: string | null): EventoFormValues => ({
  tipo: tipoSugerido(estado),
  fecha: new Date().toISOString().slice(0, 10),
  ubicacion: "",
  descripcion: "",
});

interface Props {
  embarqueId: string;
  estadoActual?: string | null;
  fechaLlegadaRealActual?: string | null;
  onClose: () => void;
}

export function TrackingNuevoEventoForm({ embarqueId, estadoActual, fechaLlegadaRealActual, onClose }: Props) {
  const crearEvento = useCreateEventoEmbarque();
  const actualizarFechaLlegada = useActualizarFechaLlegadaReal();
  const { user } = useAuth();
  const { toast } = useToast();
  const [confirmLlegada, setConfirmLlegada] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<EventoFormValues>({
    resolver: zodResolver(eventoTrackingSchema),
    defaultValues: defaultEventoValues(estadoActual),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const fechaIso = new Date(`${values.fecha}T00:00:00`).toISOString();
      await crearEvento.mutateAsync({
        embarqueId,
        tipo: values.tipo,
        descripcion: "",
        ubicacion: "",
        fecha: fechaIso,
        usuario: user?.email ?? "",
      });
      notifySuccess(toast, { title: "Evento registrado" });
      reset(defaultEventoValues(estadoActual));

      // Si el tipo de evento sugiere arribo y no hay fecha de llegada real (o es diferente),
      // ofrecemos actualizarla con un confirm dialog antes de cerrar.
      if (TIPOS_QUE_ACTUALIZAN_LLEGADA.has(values.tipo)) {
        const existente = fechaLlegadaRealActual ? new Date(fechaLlegadaRealActual).getTime() : null;
        const nueva = new Date(fechaIso).getTime();
        if (existente === null || Math.abs(existente - nueva) > 60_000) {
          setConfirmLlegada(fechaIso);
          return;
        }
      }
      onClose();
    } catch (err: unknown) {
      notifyError(toast, {
        title: "Error al registrar evento",
        description: getErrorMessage(err),
        error: err,
        method: "TRACKING_NUEVO_EVENTO_FORM",
      });
    }
  });

  const handleConfirmLlegada = async () => {
    if (!confirmLlegada) return;
    try {
      await actualizarFechaLlegada.mutateAsync({ embarqueId, fechaIso: confirmLlegada });
      notifySuccess(toast, { title: "Fecha de llegada real actualizada" });
    } catch (err: unknown) {
      notifyError(toast, {
        title: "Error al actualizar fecha de llegada",
        description: getErrorMessage(err),
        error: err,
        method: "TRACKING_UPDATE_FECHA_LLEGADA",
      });
    } finally {
      setConfirmLlegada(null);
      onClose();
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Nuevo Evento de Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de evento *</label>
              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_EVENTO_TRACKING.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ICONO_EVENTO[t]} {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tipo && <p className="text-xs text-destructive">{errors.tipo.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha *</label>
              <Input type="date" {...register("fecha")} required />
              {errors.fecha && <p className="text-xs text-destructive">{errors.fecha.message}</p>}
              <p className="text-xs text-muted-foreground">
                Usa la fecha del último evento publicado por la naviera.
              </p>
            </div>
            <div className="md:col-span-2 flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={!isValid || crearEvento.isPending}>
                {crearEvento.isPending ? "Guardando..." : "Guardar Evento"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmLlegada} onOpenChange={(open) => !open && setConfirmLlegada(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Actualizar fecha de llegada real?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Quieres registrar{" "}
              <strong>{confirmLlegada ? formatDate(confirmLlegada, "dd/MM/yyyy") : ""}</strong> como
              la fecha de llegada real del embarque? Esto actualiza la ETA real visible para todos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConfirmLlegada(null); onClose(); }}>
              No, sólo el evento
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLlegada}>Sí, actualizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
