import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, toTitleCase, nombreDesdeEmail, formatNumber } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { ESTADOS_EMBARQUE } from "@/constants/embarqueConstants";
import { DetailRow } from "./DetailRow";
import { useNavigate } from "react-router-dom";
import { Link } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import type { EmbarqueRow } from "@/hooks/embarque/useEmbarques";
import { calcularEstadoEmbarque } from "@/lib/domain/embarque";
import { useEmbarquesRelacionados } from "@/hooks/embarque/useEmbarquesRelacionados";

type RelacionadoRow = ReturnType<typeof useEmbarquesRelacionados>["data"] extends (infer U)[] | undefined ? U : never;

interface Props {
  embarque: EmbarqueRow;
}

export function TabResumen({ embarque }: Props) {
  const navigate = useNavigate();
  const estadoVisual = calcularEstadoEmbarque(embarque.modo, embarque.tipo, embarque.etd, embarque.eta, embarque.estado);
  const currentStepIndex = ESTADOS_EMBARQUE.indexOf(estadoVisual as typeof ESTADOS_EMBARQUE[number]);

  const { data: relacionados = [] } = useEmbarquesRelacionados(embarque.id, embarque.bl_master);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            {ESTADOS_EMBARQUE.map((estado, i) => (
              <div key={estado} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    i <= currentStepIndex ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                  }`}>{i + 1}</div>
                  <span className={`text-[10px] mt-1 text-center ${i <= currentStepIndex ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{estado}</span>
                </div>
                {i < ESTADOS_EMBARQUE.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${i < currentStepIndex ? 'bg-accent' : 'bg-border'}`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
        <Card className="h-full">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Datos Generales</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Modo" value={<><ModoIcon modo={embarque.modo} size={14} /> {embarque.modo}</>} />
            <DetailRow label="Tipo" value={embarque.tipo} />
            <DetailRow label="Incoterm" value={embarque.incoterm} />
            <DetailRow label="Mercancía" value={toTitleCase(embarque.descripcion_mercancia)} />
            <DetailRow label="Peso" value={formatNumber(Number(embarque.peso_kg), { suffix: "kg" })} />
            <DetailRow label="Volumen" value={formatNumber(Number(embarque.volumen_m3), { decimals: 2, suffix: "m³" })} />
            <DetailRow label="Piezas" value={formatNumber(embarque.piezas)} />
            <DetailRow label="Operador" value={nombreDesdeEmail(embarque.operador)} />
          </CardContent>
        </Card>

        <Card className="h-full">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
        <Card className="h-full">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Shipper</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{toTitleCase(embarque.shipper)}</CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Consignatario</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{toTitleCase(embarque.consignatario)}</CardContent>
        </Card>
      </div>

      {relacionados.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link className="h-4 w-4" />
              Embarques Relacionados (BL Master: {embarque.bl_master})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={[
                { key: "expediente", header: "Expediente", className: "font-medium", render: (r: RelacionadoRow) => r.expediente },
                { key: "bl_house", header: "BL House", className: "text-xs", render: (r: RelacionadoRow) => r.bl_house || '-' },
                { key: "contenedor", header: "Contenedor", className: "text-xs", render: (r: RelacionadoRow) => r.contenedor ? `${r.contenedor}${r.tipo_contenedor ? ` (${r.tipo_contenedor})` : ''}` : '-' },
                { key: "shipper", header: "Shipper", className: "text-xs", render: (r: RelacionadoRow) => toTitleCase(r.shipper) },
                { key: "estado", header: "Estado", render: (r: RelacionadoRow) => (
                  <Badge variant="secondary" className={`text-xs ${getEstadoColor(r.estado)}`}>{r.estado}</Badge>
                ) },
              ]}
              data={relacionados}
              rowKey={(r) => r.id}
              density="compact"
              onRowClick={(r) => navigate(`/embarques/${r.id}`)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
