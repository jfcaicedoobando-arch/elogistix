import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StepValidationErrors } from "@/lib/domain/embarqueWizardSchemas";
import type { EmbarqueFormValues } from "@/hooks/embarque";

const errClass = "text-xs text-destructive mt-1";

export function StepDatosRutaAereo({ errors }: { errors: StepValidationErrors }) {
  const { register } = useFormContext<EmbarqueFormValues>();
  return (
    <>
      <div className="space-y-2">
        <Label>Aeropuerto Origen *</Label>
        <Input placeholder="Ej: Incheon (ICN)" {...register('aeropuertoOrigen')} />
        {errors.aeropuertoOrigen && <p className={errClass}>{errors.aeropuertoOrigen}</p>}
      </div>
      <div className="space-y-2">
        <Label>Aeropuerto Destino *</Label>
        <Input placeholder="Ej: AICM (MEX)" {...register('aeropuertoDestino')} />
        {errors.aeropuertoDestino && <p className={errClass}>{errors.aeropuertoDestino}</p>}
      </div>
      <div className="space-y-2"><Label>Aerolínea</Label><Input {...register('aerolinea')} /></div>
      <div className="space-y-2">
        <Label># MAWB *</Label>
        <Input {...register('mawb')} />
        {errors.mawb && <p className={errClass}>{errors.mawb}</p>}
      </div>
      <div className="space-y-2"><Label># HAWB</Label><Input {...register('hawb')} /></div>
    </>
  );
}
