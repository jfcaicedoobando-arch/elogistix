import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PortSelect from "@/components/catalogos/PortSelect";
import NavieraSelect from "@/components/catalogos/NavieraSelect";
import { ListaContenedoresEditable } from "@/features/embarques/components/contenedores/ListaContenedoresEditable";
import { crearContenedorVacio } from "@/features/embarques/types/contenedor";
import type { StepValidationErrors } from "@/features/embarques/domain/embarqueWizardSchemas";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";

const errClass = "text-xs text-destructive mt-1";

interface Props {
  errors: StepValidationErrors;
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

export function StepDatosRutaMaritimo({ errors }: Props) {
  const { register, watch, setValue } = useFormContext<EmbarqueFormValues>();
  const tipoServicio = watch('tipoServicio');
  const contenedores = watch('contenedores') ?? [];

  const handleTipoServicioChange = (v: string) => {
    setValue('tipoServicio', v, { shouldValidate: true, shouldDirty: true });
    if (v === 'LCL') {
      setValue('tipoContenedor', 'LCL', { shouldValidate: true, shouldDirty: true });
      setValue('contenedores', [], { shouldValidate: true, shouldDirty: true });
    } else if (v === 'FCL' && contenedores.length === 0) {
      setValue('contenedores', [crearContenedorVacio(1)], { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <>
      <div className="space-y-2">
        <Label>Puerto Origen *</Label>
        <Controller name="puertoOrigen" render={({ field }) => (
          <PortSelect value={field.value} onValueChange={field.onChange} placeholder="Seleccionar puerto origen" />
        )} />
        {errors.puertoOrigen && <p className={errClass}>{errors.puertoOrigen}</p>}
      </div>
      <div className="space-y-2">
        <Label>Puerto Destino *</Label>
        <Controller name="puertoDestino" render={({ field }) => (
          <PortSelect value={field.value} onValueChange={field.onChange} placeholder="Seleccionar puerto destino" />
        )} />
        {errors.puertoDestino && <p className={errClass}>{errors.puertoDestino}</p>}
      </div>
      <div className="space-y-2">
        <Label>Naviera *</Label>
        <Controller name="naviera" render={({ field }) => (
          <NavieraSelect value={field.value} onValueChange={field.onChange} />
        )} />
        {errors.naviera && <p className={errClass}>{errors.naviera}</p>}
      </div>
      <div className="space-y-2"><Label>Agente</Label><Input placeholder="Nombre del agente" {...register('agente')} /></div>
      <div className="space-y-2"><Label># BL Master</Label><Input placeholder="Número de BL" {...register('blMaster')} /></div>
      <div className="space-y-2"><Label># BL House</Label><Input {...register('blHouse')} /></div>
      <div className="space-y-2">
        <Label>Tipo de Servicio *</Label>
        <Controller name="tipoServicio" render={({ field }) => (
          <Select value={field.value} onValueChange={handleTipoServicioChange}>
            <SelectTrigger><SelectValue placeholder="FCL / LCL" /></SelectTrigger>
            <SelectContent><SelectItem value="FCL">FCL</SelectItem><SelectItem value="LCL">LCL</SelectItem></SelectContent>
          </Select>
        )} />
        {errors.tipoServicio && <p className={errClass}>{errors.tipoServicio}</p>}
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>Contenedores *</Label>
        {tipoServicio === 'LCL' ? (
          <Input value="LCL (Carga Consolidada) — se asigna automáticamente" disabled />
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
