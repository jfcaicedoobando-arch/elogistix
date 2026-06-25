import { useCallback, useEffect, useRef, useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { CheckCircle2, RotateCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { sugerirETA, type StepValidationErrors } from "@/features/embarques/domain/embarqueWizardSchemas";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";

const errClass = "text-xs text-destructive mt-1";

interface Props {
  errors: StepValidationErrors;
  diasTransitoSugerencia?: number | null;
}

// ── useEtaSugerencia ───────────────────────────────────────────────────────────

interface EtaSugerenciaResult {
  hasSugerencia: boolean;
  sugerencia: string | null;
  autoApplied: boolean;
  recalcular: () => void;
}

function useEtaSugerencia(
  etd: string,
  eta: string,
  diasTransitoSugerencia: number | null | undefined,
): EtaSugerenciaResult {
  const { setValue } = useFormContext<EmbarqueFormValues>();
  const [autoApplied, setAutoApplied] = useState(false);
  const lastAppliedRef = useRef<string | null>(null);

  const hasSugerencia = !!diasTransitoSugerencia && diasTransitoSugerencia > 0;
  const sugerencia = hasSugerencia ? sugerirETA(etd, diasTransitoSugerencia ?? 0) : null;

  useEffect(() => {
    if (!hasSugerencia) return;
    if (sugerencia && eta === sugerencia) {
      lastAppliedRef.current = sugerencia;
      setAutoApplied(true);
    } else if (autoApplied && eta !== lastAppliedRef.current) {
      setAutoApplied(false);
    }
  }, [eta, sugerencia, hasSugerencia, autoApplied]);

  const recalcular = useCallback(() => {
    if (!sugerencia) return;
    setValue("eta", sugerencia, { shouldDirty: true, shouldValidate: true });
    lastAppliedRef.current = sugerencia;
    setAutoApplied(true);
  }, [sugerencia, setValue]);

  return { hasSugerencia, sugerencia, autoApplied, recalcular };
}

// ── EtaLabelAdornment ──────────────────────────────────────────────────────────

interface EtaAdornmentProps {
  hasSugerencia: boolean;
  autoApplied: boolean;
  sugerencia: string | null;
  eta: string;
  etd: string;
  diasTransitoSugerencia: number | null | undefined;
  recalcular: () => void;
}

function EtaLabelAdornment({
  hasSugerencia,
  autoApplied,
  sugerencia,
  eta,
  etd,
  diasTransitoSugerencia,
  recalcular,
}: EtaAdornmentProps) {
  if (!hasSugerencia) return null;

  if (autoApplied) {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
        <CheckCircle2 className="h-3 w-3" />
        ETA sugerida aplicada (ETD + {diasTransitoSugerencia} días)
      </Badge>
    );
  }

  if (sugerencia && etd && eta !== sugerencia) {
    return (
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
    );
  }

  return null;
}

// ── StepDatosRutaFechas ────────────────────────────────────────────────────────

export function StepDatosRutaFechas({ errors, diasTransitoSugerencia }: Props) {
  const { control, watch } = useFormContext<EmbarqueFormValues>();
  const etd = watch("etd");
  const eta = watch("eta");
  const { hasSugerencia, sugerencia, autoApplied, recalcular } = useEtaSugerencia(etd, eta, diasTransitoSugerencia);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="emb-etd">ETD (Fecha Salida) *</Label>
        <Controller
          control={control}
          name="etd"
          render={({ field }) => (
            <DatePickerMx
              value={field.value ?? ""}
              onChange={field.onChange}
              className={`w-full ${errors.etd ? "border-destructive" : ""}`}
            />
          )}
        />
        {errors.etd && <p className={errClass}>{errors.etd}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="emb-eta" className="flex items-center gap-2 flex-wrap">
          <span>ETA (Fecha Llegada Estimada) *</span>
          <EtaLabelAdornment
            hasSugerencia={hasSugerencia}
            autoApplied={autoApplied}
            sugerencia={sugerencia}
            eta={eta}
            etd={etd}
            diasTransitoSugerencia={diasTransitoSugerencia}
            recalcular={recalcular}
          />
        </Label>
        <Controller
          control={control}
          name="eta"
          render={({ field }) => (
            <DatePickerMx
              value={field.value ?? ""}
              onChange={field.onChange}
              className={`w-full ${errors.eta ? "border-destructive" : ""}`}
            />
          )}
        />
        {errors.eta && <p className={errClass}>{errors.eta}</p>}
      </div>
    </>
  );
}
