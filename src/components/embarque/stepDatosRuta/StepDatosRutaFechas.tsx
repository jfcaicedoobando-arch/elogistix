import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StepValidationErrors } from "@/lib/domain/embarqueWizardSchemas";
import type { EmbarqueFormValues } from "@/hooks/embarque";

const errClass = "text-xs text-destructive mt-1";

interface Props {
  errors: StepValidationErrors;
  diasTransitoSugerencia?: number | null;
}

export function StepDatosRutaFechas({ errors, diasTransitoSugerencia }: Props) {
  const { register } = useFormContext<EmbarqueFormValues>();
  return (
    <>
      <div className="space-y-2">
        <Label>ETD (Fecha Salida) *</Label>
        <Input type="date" {...register('etd')} />
        {errors.etd && <p className={errClass}>{errors.etd}</p>}
      </div>
      <div className="space-y-2">
        <Label>
          ETA (Fecha Llegada Estimada) *
          {diasTransitoSugerencia && diasTransitoSugerencia > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              (sugerido: ETD + {diasTransitoSugerencia} días)
            </span>
          )}
        </Label>
        <Input type="date" {...register('eta')} />
        {errors.eta && <p className={errClass}>{errors.eta}</p>}
      </div>
    </>
  );
}
