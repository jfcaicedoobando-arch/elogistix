import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, getModoIcon, getEstadoColor } from "@/lib/helpers";
import { ESTADO_TIMELINE } from "@/data/embarqueConstants";
import { DetailRow } from "./DetailRow";
import type { EmbarqueRow } from "@/hooks/useEmbarques";

interface Props {
  embarque: EmbarqueRow;
}

export function TabResumen({ embarque }: Props) {
  const currentStepIndex = ESTADO_TIMELINE.indexOf(embarque.estado as any);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            {ESTADO_TIMELINE.map((estado, i) => (
              <div key={estado} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    i <= currentStepIndex ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                  }`}>{i + 1}</div>
                  <span className={`text-[10px] mt-1 text-center ${i <= currentStepIndex ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{estado}</span>
                </div>
                {i < ESTADO_TIMELINE.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${i < currentStepIndex ? 'bg-accent' : 'bg-border'}`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Datos Generales</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Modo" value={`${getModoIcon(embarque.modo)} ${embarque.modo}`} />
            <DetailRow label="Tipo" value={embarque.tipo} />
            <DetailRow label="Incoterm" value={embarque.incoterm} />
            <DetailRow label="Mercancía" value={embarque.descripcion_mercancia} />
            <DetailRow label="Peso" value={`${Number(embarque.peso_kg).toLocaleString()} kg`} />
            <DetailRow label="Volumen" value={`${embarque.volumen_m3} m³`} />
            <DetailRow label="Piezas" value={embarque.piezas.toString()} />
            <DetailRow label="Operador" value={embarque.operador} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Ruta y Transporte</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {embarque.modo === 'Marítimo' && (<>
              <DetailRow label="Puerto Origen" value={embarque.puerto_origen || '-'} />
              <DetailRow label="Puerto Destino" value={embarque.puerto_destino || '-'} />
              <DetailRow label="Naviera" value={embarque.naviera || '-'} />
              <DetailRow label="BL Master" value={embarque.bl_master || '-'} />
              <DetailRow label="BL House" value={embarque.bl_house || '-'} />
              <DetailRow label="Servicio" value={embarque.tipo_servicio || '-'} />
              <DetailRow label="Contenedor" value={`${embarque.contenedor || '-'} (${embarque.tipo_contenedor || '-'})`} />
            </>)}
            {embarque.modo === 'Aéreo' && (<>
              <DetailRow label="Aeropuerto Origen" value={embarque.aeropuerto_origen || '-'} />
              <DetailRow label="Aeropuerto Destino" value={embarque.aeropuerto_destino || '-'} />
              <DetailRow label="Aerolínea" value={embarque.aerolinea || '-'} />
              <DetailRow label="MAWB" value={embarque.mawb || '-'} />
              <DetailRow label="HAWB" value={embarque.hawb || '-'} />
            </>)}
            {embarque.modo === 'Terrestre' && (<>
              <DetailRow label="Ciudad Origen" value={embarque.ciudad_origen || '-'} />
              <DetailRow label="Ciudad Destino" value={embarque.ciudad_destino || '-'} />
              <DetailRow label="Transportista" value={embarque.transportista || '-'} />
              <DetailRow label="Carta Porte" value={embarque.carta_porte || '-'} />
            </>)}
            <DetailRow label="ETD" value={formatDate(embarque.etd || '')} />
            <DetailRow label="ETA" value={formatDate(embarque.eta || '')} />
            {embarque.fecha_llegada_real && <DetailRow label="Llegada Real" value={formatDate(embarque.fecha_llegada_real)} />}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Shipper</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{embarque.shipper}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Consignatario</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{embarque.consignatario}</CardContent>
        </Card>
      </div>

    </div>
  );
}
