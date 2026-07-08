import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/formatters";

const etaSchema = z.object({
  fecha: z.string().min(1, "Fecha requerida"),
  fuente: z.string().max(120, "Máximo 120 caracteres").optional().default(""),
});
type EtaForm = z.infer<typeof etaSchema>;

interface Props {
  etaActual: string | null;
  isPending: boolean;
  onSubmit: (v: EtaForm) => void | Promise<void>;
  onCancel: () => void;
}

export function ActualizarEtaForm({ etaActual, isPending, onSubmit, onCancel }: Props) {
  const { control, handleSubmit, formState: { errors, isValid } } = useForm<EtaForm>({
    resolver: zodResolver(etaSchema),
    defaultValues: { fecha: etaActual ?? "", fuente: "" },
    mode: "onChange",
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" /> Actualizar ETA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Nuevo ETA *</label>
            <Controller
              control={control}
              name="fecha"
              render={({ field }) => (
                <DatePickerMx value={field.value ?? ""} onChange={field.onChange} className="w-full" />
              )}
            />
            {errors.fecha && <p className="text-xs text-destructive">{errors.fecha.message}</p>}
            <p className="text-xs text-muted-foreground">
              ETA anterior: {etaActual ? formatDate(etaActual, "dd/MM/yyyy") : "—"}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Fuente / Motivo</label>
            <Controller
              control={control}
              name="fuente"
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="Ej. Portal Maersk, aviso del agente..."
                  maxLength={120}
                />
              )}
            />
            {errors.fuente && <p className="text-xs text-destructive">{errors.fuente.message}</p>}
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
              Volver
            </Button>
            <Button type="submit" size="sm" disabled={!isValid || isPending}>
              {isPending ? "Guardando..." : "Actualizar ETA"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
