import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PortSelect from "@/components/selects/PortSelect";
import NavieraSelect from "@/components/selects/NavieraSelect";
import { useTiposContenedor } from "@/hooks/catalogos";
import type { StepValidationErrors } from "@/lib/domain/embarqueWizardSchemas";
import type { EmbarqueFormValues } from "@/hooks/embarque";

const errClass = "text-xs text-destructive mt-1";

interface Props {
  errors: StepValidationErrors;
}

export function StepDatosRutaMaritimo({ errors }: Props) {
  const { register, watch, setValue } = useFormContext<EmbarqueFormValues>();
  const { data: tiposContenedor = [] } = useTiposContenedor();
  const tipoServicio = watch('tipoServicio');

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
          <Select value={field.value} onValueChange={(v) => { field.onChange(v); if (v === 'LCL') setValue('tipoContenedor', 'LCL'); }}>
            <SelectTrigger><SelectValue placeholder="FCL / LCL" /></SelectTrigger>
            <SelectContent><SelectItem value="FCL">FCL</SelectItem><SelectItem value="LCL">LCL</SelectItem></SelectContent>
          </Select>
        )} />
        {errors.tipoServicio && <p className={errClass}>{errors.tipoServicio}</p>}
      </div>
      <div className="space-y-2">
        <Label># Contenedor *</Label>
        <Input {...register('contenedor')} />
        {errors.contenedor && <p className={errClass}>{errors.contenedor}</p>}
      </div>
      <div className="space-y-2">
        <Label>Tipo Contenedor *</Label>
        <Controller name="tipoContenedor" render={({ field }) => (
          tipoServicio === 'LCL' ? (
            <Input value="LCL (Carga Consolidada)" disabled />
          ) : (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
              <SelectContent>
                {tiposContenedor.filter(ct => ct.code !== 'LCL').map(ct => (
                  <SelectItem key={ct.code} value={ct.code}>{ct.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        )} />
        {errors.tipoContenedor && <p className={errClass}>{errors.tipoContenedor}</p>}
      </div>
    </>
  );
}
