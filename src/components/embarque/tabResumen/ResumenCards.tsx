import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, toTitleCase, nombreDesdeEmail, formatNumber } from "@/lib/formatters";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { DetailRow } from "../DetailRow";
import { FechaConOriginal } from "./FechaConOriginal";
import type { EmbarqueRow } from "@/hooks/embarque";

function RutaMaritimo({ e }: { e: EmbarqueRow }) {
  return (
    <>
      <DetailRow label="Puerto Origen" value={e.puerto_origen || '-'} />
      <DetailRow label="Puerto Destino" value={e.puerto_destino || '-'} />
      <DetailRow label="Naviera" value={e.naviera || '-'} />
      <DetailRow label="BL Master" value={e.bl_master || '-'} />
      <DetailRow label="BL House" value={e.bl_house || '-'} />
      <DetailRow label="Servicio" value={e.tipo_servicio || '-'} />
      <DetailRow label="Contenedor" value={`${e.contenedor || '-'} (${e.tipo_contenedor || '-'})`} />
    </>
  );
}

function RutaAereo({ e }: { e: EmbarqueRow }) {
  return (
    <>
      <DetailRow label="Aeropuerto Origen" value={e.aeropuerto_origen || '-'} />
      <DetailRow label="Aeropuerto Destino" value={e.aeropuerto_destino || '-'} />
      <DetailRow label="Aerolínea" value={e.aerolinea || '-'} />
      <DetailRow label="MAWB" value={e.mawb || '-'} />
      <DetailRow label="HAWB" value={e.hawb || '-'} />
    </>
  );
}

function RutaTerrestre({ e }: { e: EmbarqueRow }) {
  return (
    <>
      <DetailRow label="Ciudad Origen" value={e.ciudad_origen || '-'} />
      <DetailRow label="Ciudad Destino" value={e.ciudad_destino || '-'} />
      <DetailRow label="Transportista" value={e.transportista || '-'} />
      <DetailRow label="Carta Porte" value={e.carta_porte || '-'} />
    </>
  );
}

export function DatosGeneralesCard({ embarque }: { embarque: EmbarqueRow }) {
  return (
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
  );
}

export function RutaTransporteCard({ embarque }: { embarque: EmbarqueRow }) {
  const orig = embarque as Partial<{ etd_original: string | null; eta_original: string | null }>;
  return (
    <Card className="h-full">
      <CardHeader className="pb-3"><CardTitle className="text-sm">Ruta y Transporte</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {embarque.modo === 'Marítimo' && <RutaMaritimo e={embarque} />}
        {embarque.modo === 'Aéreo' && <RutaAereo e={embarque} />}
        {embarque.modo === 'Terrestre' && <RutaTerrestre e={embarque} />}
        <DetailRow label="ETD" value={<FechaConOriginal actual={embarque.etd} original={orig.etd_original} />} />
        <DetailRow label="ETA" value={<FechaConOriginal actual={embarque.eta} original={orig.eta_original} />} />
        {embarque.fecha_llegada_real && (
          <DetailRow label="Llegada Real" value={formatDate(embarque.fecha_llegada_real)} />
        )}
      </CardContent>
    </Card>
  );
}
