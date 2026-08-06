import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/formatters";

/**
 * v13.320.47 — B-026: Validación de ETA
 * - `fecha` obligatoria y distinta al ETA vigente (si actualiza al mismo día
 *   no tiene sentido registrar cambio + evento de bitácora).
 * - `fuente` obligatoria (mínimo 3 caracteres) — sin fuente no hay auditoría útil.
 */
function buildEtaSchema(etaActualIso: string) {
  return z.object({
    fecha: z.string()
      .min(1, "Fecha requerida")
      .refine((v) => !etaActualIso || v !== etaActualIso, {
        message: "La nueva ETA debe ser distinta a la actual",
      }),
    fuente: z.string()
      .trim()
      .min(3, "Indica la fuente o motivo (mín. 3 caracteres)")
      .max(120, "Máximo 120 caracteres"),
  });
}
type EtaForm = z.infer<ReturnType<typeof buildEtaSchema>>;

interface Props {
  etaActual: string | null;
  isPending: boolean;
  onSubmit: (v: EtaForm) => void | Promise<void>;
  onCancel: () => void;
}

export function ActualizarEtaForm({ etaActual, isPending, onSubmit, onCancel }: Props) {
  const etaActualIso = (etaActual ?? "").slice(0, 10);
  const schema = buildEtaSchema(etaActualIso);
  const { control, handleSubmit, formState: { errors, isValid } } = useForm<EtaForm>({
    resolver: zodResolver(schema),
    defaultValues: { fecha: etaActualIso, fuente: "" },
    mode: "onChange",
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
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
                <DatePickerMx
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  className="w-full"
                  disabled={isPending}
                  errorText={errors.fecha?.message ?? null}
                />
              )}
            />
            <p className="text-xs text-muted-foreground">
              ETA anterior: {etaActualIso ? formatDate(etaActualIso, "dd/MM/yyyy") : "—"}
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
