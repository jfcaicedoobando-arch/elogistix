import { useCallback, useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { CheckCircle2, RotateCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sugerirETA, type StepValidationErrors } from "@/features/embarques/domain/embarqueWizardSchemas";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";

const errClass = "text-xs text-destructive mt-1";

interface Props {
  errors: StepValidationErrors;
  diasTransitoSugerencia?: number | null;
}

export function StepDatosRutaFechas({ errors, diasTransitoSugerencia }: Props) {
  const { register, watch, setValue } = useFormContext<EmbarqueFormValues>();
  const etd = watch("etd");
  const eta = watch("eta");
  const [autoApplied, setAutoApplied] = useState(false);
  const lastAppliedRef = useRef<string | null>(null);

  const hasSugerencia = !!diasTransitoSugerencia && diasTransitoSugerencia > 0;
  const sugerencia = hasSugerencia ? sugerirETA(etd, diasTransitoSugerencia ?? 0) : null;

  // Si el usuario edita ETA manualmente (distinto al último valor que aplicamos),
  // dejamos de marcar como "Aplicada".
  useEffect(() => {
    if (autoApplied && eta !== lastAppliedRef.current) {
      setAutoApplied(false);
    }
  }, [eta, autoApplied]);

  const recalcular = useCallback(() => {
    if (!sugerencia) return;
    setValue("eta", sugerencia, { shouldDirty: true, shouldValidate: true });
    lastAppliedRef.current = sugerencia;
    setAutoApplied(true);
  }, [sugerencia, setValue]);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="emb-etd">ETD (Fecha Salida) *</Label>
        <Input
          id="emb-etd"
          type="date"
          aria-invalid={errors.etd ? true : undefined}
          className={errors.etd ? "border-destructive" : ""}
          {...register("etd")}
        />
        {errors.etd && <p className={errClass}>{errors.etd}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="emb-eta" className="flex items-center gap-2 flex-wrap">
          <span>ETA (Fecha Llegada Estimada) *</span>
          {hasSugerencia && autoApplied && (
            <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
              <CheckCircle2 className="h-3 w-3" />
              ETA sugerida aplicada (ETD + {diasTransitoSugerencia} días)
            </Badge>
          )}
          {hasSugerencia && !autoApplied && sugerencia && etd && eta !== sugerencia && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] gap-1"
              onClick={recalcular}
              aria-label={`Aplicar ETA sugerida (${sugerencia})`}
            >
              <RotateCw className="h-3 w-3" />
              Usar sugerencia ({diasTransitoSugerencia} días)
            </Button>
          )}
        </Label>
        <Input
          id="emb-eta"
          type="date"
          min={etd || undefined}
          aria-invalid={errors.eta ? true : undefined}
          className={errors.eta ? "border-destructive" : ""}
          {...register("eta")}
        />
        {errors.eta && <p className={errClass}>{errors.eta}</p>}
      </div>
    </>
  );
}
