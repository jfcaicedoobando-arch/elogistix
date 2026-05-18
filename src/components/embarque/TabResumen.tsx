import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { differenceInCalendarDays } from "date-fns";
import { formatDate, toTitleCase, nombreDesdeEmail, formatNumber } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { ESTADOS_EMBARQUE } from "@/constants/embarqueConstants";
import { DetailRow } from "./DetailRow";
import { useNavigate } from "react-router-dom";
import { Link } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
// eslint-disable-next-line no-restricted-imports -- render row custom para sub-tabla de embarques relacionados
import { TableRow, TableCell } from "@/components/ui/table";
import type { EmbarqueRow } from "@/hooks/embarque";
import { calcularEstadoEmbarque } from "@/lib/domain/embarque";
import { useEmbarquesRelacionados } from "@/hooks/embarque";

type RelacionadoRow = ReturnType<typeof useEmbarquesRelacionados>["data"] extends (infer U)[] | undefined ? U : never;

function FechaConOriginal({ actual, original }: { actual: string | null; original: string | null | undefined }) {
  if (!actual && !original) return <>-</>;
  const actualLabel = actual ? formatDate(actual) : "-";
  if (!original || !actual || original === actual) {
    return <>{actualLabel}</>;
  }
  const diff = differenceInCalendarDays(new Date(actual + "T00:00:00"), new Date(original + "T00:00:00"));
  const signo = diff > 0 ? `+${diff}d` : `${diff}d`;
  const tono = diff > 0 ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-emerald-100 text-emerald-800 border-emerald-200";
  return (
    <span className="inline-flex items-center gap-2">
      <span>{actualLabel}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-[10px] font-normal ${tono}`}>
            Original: {formatDate(original)} ({signo})
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Fecha cotizada al cliente. La fecha actual difiere {signo} respecto a la original.</TooltipContent>
      </Tooltip>
    </span>
  );
}

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
            {(() => {
              const orig = embarque as Partial<{ etd_original: string | null; eta_original: string | null }>;
              return (
                <>
                  <DetailRow label="ETD" value={<FechaConOriginal actual={embarque.etd} original={orig.etd_original} />} />
                  <DetailRow label="ETA" value={<FechaConOriginal actual={embarque.eta} original={orig.eta_original} />} />
                </>
              );
            })()}
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

      {relacionados.length > 1 && (() => {
        const totalPeso = relacionados.reduce((s, r) => s + (Number(r.peso_kg) || 0), 0);
        const totalVol = relacionados.reduce((s, r) => s + (Number(r.volumen_m3) || 0), 0);
        const totalPiezas = relacionados.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
        const relacionadosOrdenados = [...relacionados].sort((a, b) =>
          a.id === embarque.id ? -1 : b.id === embarque.id ? 1 : 0,
        );
        return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link className="h-4 w-4" />
              Embarques del BL Master: {embarque.bl_master}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {relacionados.length} contenedores · {formatNumber(totalPeso, { suffix: "kg" })} · {formatNumber(totalVol, { decimals: 2, suffix: "m³" })} · {formatNumber(totalPiezas)} piezas
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={[
                { key: "expediente", header: "Expediente", className: "font-medium", render: (r: RelacionadoRow) => (
                  <span className="inline-flex items-center gap-2">
                    {r.expediente}
                    {r.id === embarque.id && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Actual</Badge>}
                  </span>
                ) },
                { key: "bl_house", header: "BL House", className: "text-xs", render: (r: RelacionadoRow) => r.bl_house || '-' },
                { key: "contenedor", header: "Contenedor", className: "text-xs", render: (r: RelacionadoRow) => r.contenedor ? `${r.contenedor}${r.tipo_contenedor ? ` (${r.tipo_contenedor})` : ''}` : '-' },
                { key: "peso", header: "Peso", align: "right", className: "text-xs tabular-nums", render: (r: RelacionadoRow) => formatNumber(Number(r.peso_kg), { suffix: "kg" }) },
                { key: "volumen", header: "Volumen", align: "right", className: "text-xs tabular-nums", render: (r: RelacionadoRow) => formatNumber(Number(r.volumen_m3), { decimals: 2, suffix: "m³" }) },
                { key: "piezas", header: "Piezas", align: "right", className: "text-xs tabular-nums", render: (r: RelacionadoRow) => formatNumber(r.piezas) },
                { key: "estado", header: "Estado", render: (r: RelacionadoRow) => (
                  <Badge variant="secondary" className={`text-xs ${getEstadoColor(r.estado)}`}>{r.estado}</Badge>
                ) },
              ]}
              data={relacionadosOrdenados}
              rowKey={(r) => r.id}
              density="compact"
              rowClassName={(r) => r.id === embarque.id ? 'bg-accent/10 font-medium' : ''}
              onRowClick={(r) => r.id !== embarque.id && navigate(`/embarques/${r.id}`)}
              footer={
                <TableRow className="hover:bg-transparent even:bg-transparent font-semibold">
                  <TableCell colSpan={3} className="text-xs text-right">Totales:</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{formatNumber(totalPeso, { suffix: "kg" })}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{formatNumber(totalVol, { decimals: 2, suffix: "m³" })}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{formatNumber(totalPiezas)}</TableCell>
                  <TableCell />
                </TableRow>
              }
            />
          </CardContent>
        </Card>
        );
      })()}
    </div>
  );
}
