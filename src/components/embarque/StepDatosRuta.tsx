import { useEffect } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTiposContenedor } from "@/hooks/catalogos/useTiposContenedor";
import PortSelect from "@/components/selects/PortSelect";
import NavieraSelect from "@/components/selects/NavieraSelect";
import { sugerirETA, type StepValidationErrors } from "@/lib/domain/embarqueWizardSchemas";
import { ValidationAlert } from "@/components/feedback/ValidationAlert";
import type { EmbarqueFormValues } from "@/hooks/embarque/useEmbarqueForm";

interface Props {
  errors?: StepValidationErrors;
  /** Días de tránsito de la cotización vinculada (para sugerir ETA al elegir ETD). */
  diasTransitoSugerencia?: number | null;
}

const errClass = "text-xs text-destructive mt-1";

export function StepDatosRuta({ errors = {}, diasTransitoSugerencia }: Props) {
  const { register, watch, setValue } = useFormContext<EmbarqueFormValues>();
  const modo = watch('modo');
  const etd = watch('etd');
  const eta = watch('eta');
  const { data: tiposContenedor = [] } = useTiposContenedor();

  // Sugerir ETA cuando se ingresa ETD y hay días de tránsito de cotización
  useEffect(() => {
    if (etd && !eta && diasTransitoSugerencia && diasTransitoSugerencia > 0) {
      const sug = sugerirETA(etd, diasTransitoSugerencia);
      if (sug) setValue('eta', sug, { shouldDirty: true });
    }
  }, [etd, eta, diasTransitoSugerencia, setValue]);

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Card>
      <CardHeader><CardTitle>Datos de Ruta {modo && `— ${modo}`}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {hasErrors && <ValidationAlert severity="error" errors={errors} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(modo === 'Marítimo' || !modo) && (<>
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
              <Controller name="tipoContenedor" render={({ field }) => {
                const tipoServicio = watch('tipoServicio');
                return tipoServicio === 'LCL' ? (
                  <Input value="LCL (Carga Consolidada)" disabled />
                ) : (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                    <SelectContent>{tiposContenedor.filter(ct => ct.code !== 'LCL').map(ct => <SelectItem key={ct.code} value={ct.code}>{ct.name}</SelectItem>)}</SelectContent>
                  </Select>
                );
              }} />
              {errors.tipoContenedor && <p className={errClass}>{errors.tipoContenedor}</p>}
            </div>
          </>)}
          {modo === 'Aéreo' && (<>
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
          </>)}
          {modo === 'Terrestre' && (<>
            <div className="space-y-2">
              <Label>Ciudad Origen *</Label>
              <Input placeholder="Ej: Houston, TX" {...register('ciudadOrigen')} />
              {errors.ciudadOrigen && <p className={errClass}>{errors.ciudadOrigen}</p>}
            </div>
            <div className="space-y-2">
              <Label>Ciudad Destino *</Label>
              <Input placeholder="Ej: León, Guanajuato" {...register('ciudadDestino')} />
              {errors.ciudadDestino && <p className={errClass}>{errors.ciudadDestino}</p>}
            </div>
            <div className="space-y-2">
              <Label>Transportista *</Label>
              <Input {...register('transportista')} />
              {errors.transportista && <p className={errClass}>{errors.transportista}</p>}
            </div>
            <div className="space-y-2"><Label># Carta Porte</Label><Input {...register('cartaPorte')} /></div>
          </>)}
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
        </div>
      </CardContent>
    </Card>
  );
}
