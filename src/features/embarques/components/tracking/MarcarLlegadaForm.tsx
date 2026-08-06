import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Anchor } from "lucide-react";
import { todayLocalISO } from "@/lib/date/today";

const llegadaSchema = z.object({
  fecha: z.string().min(1, "Fecha requerida"),
  ubicacion: z.string().max(120, "Máximo 120 caracteres").optional().default(""),
});
type LlegadaForm = z.infer<typeof llegadaSchema>;

interface Props {
  fechaLlegadaActual: string | null;
  destinoDefault: string;
  isPending: boolean;
  onSubmit: (v: LlegadaForm) => void | Promise<void>;
  onCancel: () => void;
}

export function MarcarLlegadaForm({
  fechaLlegadaActual,
  destinoDefault,
  isPending,
  onSubmit,
  onCancel,
}: Props) {
  const hoy = todayLocalISO();
  const { control, handleSubmit, formState: { errors, isValid } } = useForm<LlegadaForm>({
    resolver: zodResolver(llegadaSchema),
    defaultValues: {
      fecha: (fechaLlegadaActual ?? "").slice(0, 10) || hoy,
      ubicacion: destinoDefault,
    },
    mode: "onChange",
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Anchor className="h-4 w-4 text-primary" /> Marcar Llegada real
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha de llegada real *</label>
            <Controller
              control={control}
              name="fecha"
              render={({ field }) => (
                <DatePickerMx
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  className="w-full"
                  max={hoy}
                  disabled={isPending}
                  errorText={errors.fecha?.message ?? null}
                />
              )}
            />
            <p className="text-xs text-muted-foreground">
              Al guardar, el embarque avanza a "Llegada".
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ubicación / Puerto</label>
            <Controller
              control={control}
              name="ubicacion"
              render={({ field }) => (
                <Input {...field} placeholder="Puerto o punto de arribo" maxLength={120} disabled={isPending} />
              )}
            />
            {errors.ubicacion && <p className="text-xs text-destructive">{errors.ubicacion.message}</p>}
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
              Volver
            </Button>
            <Button type="submit" size="sm" disabled={!isValid || isPending}>
              {isPending ? "Guardando..." : "Registrar llegada"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

