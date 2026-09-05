import { useFormContext, Controller } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PortSelect from "@/features/catalogos/components/PortSelect";
import {
  AgenteEmbarqueSelector,
  NavieraEmbarqueSelector,
} from "@/features/embarques/components/stepDatosRuta/AgenteNavieraHeredados";
import { ListaContenedoresEditable } from "@/features/embarques/components/contenedores/ListaContenedoresEditable";
import { contenedorSembradoDesdeGenerales } from "@/features/embarques/domain/semillaContenedor";
import type { StepValidationErrors } from "@/features/embarques/domain/embarqueWizardSchemas";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";

const errClass = "text-body-sm text-destructive mt-1";

interface Props {
  errors: StepValidationErrors;
  /** IDs originales heredados desde la cotización (para badge/restaurar). */
  cotizacionAgenteId?: string | null;
  cotizacionNavieraId?: string | null;
}

/** Filtra errores de filas de contenedores para no duplicar mensajes. */
function filaErrores(errors: StepValidationErrors, index: number): string[] {
  const out: string[] = [];
  const numero = errors[`contenedores.${index}.numero_contenedor`];
  const tipo = errors[`contenedores.${index}.tipo_contenedor`];
  if (numero) out.push(numero);
  if (tipo) out.push(tipo);
  return out;
}

export function StepDatosRutaMaritimo({ errors, cotizacionAgenteId, cotizacionNavieraId }: Props) {
  const { register, watch, setValue } = useFormContext<EmbarqueFormValues>();
  const tipoServicio = watch('tipoServicio');
  const contenedores = watch('contenedores') ?? [];

  const handleTipoServicioChange = (v: string) => {
    setValue('tipoServicio', v, { shouldValidate: true, shouldDirty: true });
    if (v === 'LCL') {
      setValue('tipoContenedor', 'LCL', { shouldValidate: true, shouldDirty: true });
      setValue('contenedores', [], { shouldValidate: true, shouldDirty: true });
    } else if (v === 'FCL' && contenedores.length === 0) {
      // B4: en FCL los totales se derivan de los contenedores, así que el
      // primero se siembra con las cantidades ya capturadas en Datos generales
      // (si no, el resumen quedaba en 0 y se perdía lo capturado).
      const semilla = contenedorSembradoDesdeGenerales({
        pesoKg: watch('pesoKg'),
        volumenM3: watch('volumenM3'),
        piezas: watch('piezas'),
      });
      setValue('contenedores', [semilla], { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <>
      <div className="space-y-2">
        <Label>Puerto Origen *</Label>
        <Controller name="puertoOrigen" render={({ field }) => (
          <PortSelect
            value={field.value}
            onValueChange={field.onChange}
            placeholder="Seleccionar puerto origen"
            className={cn(errors.puertoOrigen && 'border-destructive')}
            aria-invalid={errors.puertoOrigen ? true : undefined}
          />
        )} />
        {errors.puertoOrigen && <p className={errClass}>{errors.puertoOrigen}</p>}
      </div>
      <div className="space-y-2">
        <Label>Puerto Destino *</Label>
        <Controller name="puertoDestino" render={({ field }) => (
          <PortSelect
            value={field.value}
            onValueChange={field.onChange}
            placeholder="Seleccionar puerto destino"
            className={cn(errors.puertoDestino && 'border-destructive')}
            aria-invalid={errors.puertoDestino ? true : undefined}
          />
        )} />
        {errors.puertoDestino && <p className={errClass}>{errors.puertoDestino}</p>}
      </div>
      <NavieraEmbarqueSelector cotizacionNavieraId={cotizacionNavieraId} />
      <AgenteEmbarqueSelector cotizacionAgenteId={cotizacionAgenteId} />
      <div className="space-y-2"><Label htmlFor="emb-bl-master"># BL Master</Label><Input id="emb-bl-master" placeholder="Número de BL" {...register('blMaster')} /></div>
      <div className="space-y-2"><Label htmlFor="emb-bl-house"># BL House</Label><Input id="emb-bl-house" {...register('blHouse')} /></div>
      <div className="space-y-2">
        <Label>Tipo de Servicio *</Label>
        <Controller name="tipoServicio" render={({ field }) => (
          <Select value={field.value} onValueChange={handleTipoServicioChange}>
            <SelectTrigger
              aria-invalid={errors.tipoServicio ? true : undefined}
              className={cn(errors.tipoServicio && 'border-destructive')}
            >
              <SelectValue placeholder="FCL / LCL" />
            </SelectTrigger>
            <SelectContent><SelectItem value="FCL">FCL</SelectItem><SelectItem value="LCL">LCL</SelectItem></SelectContent>
          </Select>
        )} />
        {errors.tipoServicio && <p className={errClass}>{errors.tipoServicio}</p>}
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>Contenedores *</Label>
        {tipoServicio === 'LCL' ? (
          <Input aria-label="Contenedores" value="LCL (Carga Consolidada) — se asigna automáticamente" disabled />
        ) : (
          <>
            <Controller
              name="contenedores"
              render={({ field }) => (
                <ListaContenedoresEditable
                  value={field.value ?? []}
                  onChange={field.onChange}
                  minRows={1}
                />
              )}
            />
            {errors.contenedores && <p className={errClass}>{errors.contenedores}</p>}
            {(contenedores ?? []).map((_, i) => {
              const msgs = filaErrores(errors, i);
              if (msgs.length === 0) return null;
              return (
                <p key={`err-${i}`} className={errClass}>
                  Contenedor #{i + 1}: {msgs.join(" · ")}
                </p>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
