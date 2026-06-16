import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StepValidationErrors } from "@/features/embarques/domain/embarqueWizardSchemas";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";

const errClass = "text-xs text-destructive mt-1";

export function StepDatosRutaAereo({ errors }: { errors: StepValidationErrors }) {
  const { register } = useFormContext<EmbarqueFormValues>();
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="emb-aeropuerto-origen">Aeropuerto Origen *</Label>
        <Input id="emb-aeropuerto-origen" placeholder="Ej: Incheon (ICN)" {...register('aeropuertoOrigen')} />
        {errors.aeropuertoOrigen && <p className={errClass}>{errors.aeropuertoOrigen}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="emb-aeropuerto-destino">Aeropuerto Destino *</Label>
        <Input id="emb-aeropuerto-destino" placeholder="Ej: AICM (MEX)" {...register('aeropuertoDestino')} />
        {errors.aeropuertoDestino && <p className={errClass}>{errors.aeropuertoDestino}</p>}
      </div>
      <div className="space-y-2"><Label htmlFor="emb-aerolinea">Aerolínea</Label><Input id="emb-aerolinea" {...register('aerolinea')} /></div>
      <div className="space-y-2">
        <Label htmlFor="emb-mawb"># MAWB *</Label>
        <Input id="emb-mawb" {...register('mawb')} />
        {errors.mawb && <p className={errClass}>{errors.mawb}</p>}
      </div>
      <div className="space-y-2"><Label htmlFor="emb-hawb"># HAWB</Label><Input id="emb-hawb" {...register('hawb')} /></div>
    </>
  );
}
