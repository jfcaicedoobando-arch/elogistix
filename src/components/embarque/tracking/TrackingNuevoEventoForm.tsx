import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateEventoEmbarque, TIPOS_EVENTO_TRACKING } from "@/hooks/embarque";
import { ICONO_EVENTO } from "@/constants/embarqueConstants";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

const eventoSchema = z.object({
  tipo: z.string().min(1, "Selecciona un tipo de evento"),
  fecha: z.string().min(1, "Fecha requerida"),
  ubicacion: z.string().max(120, "Máximo 120 caracteres").optional().default(""),
  descripcion: z.string().max(500, "Máximo 500 caracteres").optional().default(""),
});

type EventoFormValues = z.infer<typeof eventoSchema>;

const defaultEventoValues = (): EventoFormValues => ({
  tipo: "",
  fecha: new Date().toISOString().slice(0, 16),
  ubicacion: "",
  descripcion: "",
});

interface Props {
  embarqueId: string;
  onClose: () => void;
}

export function TrackingNuevoEventoForm({ embarqueId, onClose }: Props) {
  const crearEvento = useCreateEventoEmbarque();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<EventoFormValues>({
    resolver: zodResolver(eventoSchema),
    defaultValues: defaultEventoValues(),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await crearEvento.mutateAsync({
        embarqueId,
        tipo: values.tipo,
        descripcion: values.descripcion ?? "",
        ubicacion: values.ubicacion ?? "",
        fecha: new Date(values.fecha).toISOString(),
        usuario: user?.email ?? "",
      });
      notifySuccess(toast, { title: "Evento registrado" });
      reset(defaultEventoValues());
      onClose();
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al registrar evento", description: getErrorMessage(err) });
    }
  });

  return (
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
            <label className="text-sm font-medium">Fecha y hora *</label>
            <Input type="datetime-local" {...register("fecha")} required />
            {errors.fecha && <p className="text-xs text-destructive">{errors.fecha.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ubicación</label>
            <Input {...register("ubicacion")} placeholder="Puerto, ciudad, terminal..." />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Descripción</label>
            <Textarea {...register("descripcion")} placeholder="Detalles del evento..." rows={2} />
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
  );
}
