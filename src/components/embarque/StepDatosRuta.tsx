import { useFormContext, Controller } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { containerTypes } from "@/data/containerTypes";
import PortSelect from "@/components/PortSelect";
import ShippingLineSelect from "@/components/ShippingLineSelect";
import type { EmbarqueFormValues } from "@/hooks/useEmbarqueForm";

export function StepDatosRuta() {
  const { register, watch, setValue } = useFormContext<EmbarqueFormValues>();
  const modo = watch('modo');

  return (
    <Card>
      <CardHeader><CardTitle>Datos de Ruta {modo && `— ${modo}`}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(modo === 'Marítimo' || !modo) && (<>
            <div className="space-y-2">
              <Label>Puerto Origen *</Label>
              <Controller name="puertoOrigen" render={({ field }) => (
                <PortSelect value={field.value} onValueChange={field.onChange} placeholder="Seleccionar puerto origen" />
              )} />
            </div>
            <div className="space-y-2">
              <Label>Puerto Destino *</Label>
              <Controller name="puertoDestino" render={({ field }) => (
                <PortSelect value={field.value} onValueChange={field.onChange} placeholder="Seleccionar puerto destino" />
              )} />
            </div>
            <div className="space-y-2">
              <Label>Naviera *</Label>
              <Controller name="naviera" render={({ field }) => (
                <ShippingLineSelect value={field.value} onValueChange={field.onChange} />
              )} />
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
            </div>
            <div className="space-y-2"><Label># Contenedor *</Label><Input {...register('contenedor')} /></div>
            <div className="space-y-2">
              <Label>Tipo Contenedor *</Label>
              <Controller name="tipoContenedor" render={({ field }) => {
                const tipoServicio = watch('tipoServicio');
                return tipoServicio === 'LCL' ? (
                  <Input value="LCL (Carga Consolidada)" disabled />
                ) : (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                    <SelectContent>{containerTypes.filter(ct => ct.code !== 'LCL').map(ct => <SelectItem key={ct.code} value={ct.code}>{ct.name}</SelectItem>)}</SelectContent>
                  </Select>
                );
              }} />
            </div>
          </>)}
          {modo === 'Aéreo' && (<>
            <div className="space-y-2"><Label>Aeropuerto Origen</Label><Input placeholder="Ej: Incheon (ICN)" {...register('aeropuertoOrigen')} /></div>
            <div className="space-y-2"><Label>Aeropuerto Destino</Label><Input placeholder="Ej: AICM (MEX)" {...register('aeropuertoDestino')} /></div>
            <div className="space-y-2"><Label>Aerolínea</Label><Input {...register('aerolinea')} /></div>
            <div className="space-y-2"><Label># MAWB</Label><Input {...register('mawb')} /></div>
            <div className="space-y-2"><Label># HAWB</Label><Input {...register('hawb')} /></div>
          </>)}
          {modo === 'Terrestre' && (<>
            <div className="space-y-2"><Label>Ciudad Origen</Label><Input placeholder="Ej: Houston, TX" {...register('ciudadOrigen')} /></div>
            <div className="space-y-2"><Label>Ciudad Destino</Label><Input placeholder="Ej: León, Guanajuato" {...register('ciudadDestino')} /></div>
            <div className="space-y-2"><Label>Transportista</Label><Input {...register('transportista')} /></div>
            <div className="space-y-2"><Label># Carta Porte</Label><Input {...register('cartaPorte')} /></div>
          </>)}
          <div className="space-y-2"><Label>ETD (Fecha Salida) *</Label><Input type="date" {...register('etd')} /></div>
          <div className="space-y-2"><Label>ETA (Fecha Llegada Estimada) *</Label><Input type="date" {...register('eta')} /></div>
        </div>
      </CardContent>
    </Card>
  );
}
