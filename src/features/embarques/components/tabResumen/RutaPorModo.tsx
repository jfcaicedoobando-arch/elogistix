import { DetailRow } from "../DetailRow";
import type { EmbarqueRow } from "@/features/embarques/hooks";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import { useTiposContenedor } from "@/features/catalogos/hooks/useTiposContenedor";
import { resolveTipoContenedorNombre } from "@/features/cotizacion/utils/resolveTipoContenedorNombre";

const PLACEHOLDER = "—";

function ResumenContenedores({
  embarqueId,
  fallbackTipo,
}: {
  embarqueId: string;
  fallbackTipo: string;
}) {
  const { data: contenedores = [] } = useContenedoresEmbarque(embarqueId);
  if (contenedores.length === 0) return <span>{PLACEHOLDER}</span>;
  if (contenedores.length === 1) {
    const c = contenedores[0];
    const tipo = c.tipo_contenedor || fallbackTipo || PLACEHOLDER;
    return <span>{c.numero_contenedor || PLACEHOLDER} ({tipo})</span>;
  }
  const conteos = new Map<string, number>();
  for (const c of contenedores) {
    const tipo = c.tipo_contenedor || fallbackTipo || PLACEHOLDER;
    conteos.set(tipo, (conteos.get(tipo) ?? 0) + 1);
  }
  const resumen = Array.from(conteos.entries())
    .map(([tipo, n]) => `${n} × ${tipo}`)
    .join(" · ");
  return <span>{resumen}</span>;
}

export function RutaMaritimo({ e }: { e: EmbarqueRow }) {
  const { data: tipos = [] } = useTiposContenedor();
  const tipoNombre = resolveTipoContenedorNombre(e.tipo_contenedor, tipos, PLACEHOLDER);
  return (
    <>
      <DetailRow label="Puerto Origen" value={e.puerto_origen || PLACEHOLDER} />
      <DetailRow label="Puerto Destino" value={e.puerto_destino || PLACEHOLDER} />
      <DetailRow label="Naviera" value={e.naviera || PLACEHOLDER} />
      <DetailRow label="BL Master" value={e.bl_master || PLACEHOLDER} />
      <DetailRow label="BL House" value={e.bl_house || PLACEHOLDER} />
      <DetailRow label="Servicio" value={e.tipo_servicio || PLACEHOLDER} />
      <DetailRow
        label="Contenedores"
        value={<ResumenContenedores embarqueId={e.id} fallbackTipo={tipoNombre} />}
      />
    </>
  );
}

export function RutaAereo({ e }: { e: EmbarqueRow }) {
  return (
    <>
      <DetailRow label="Aeropuerto Origen" value={e.aeropuerto_origen || PLACEHOLDER} />
      <DetailRow label="Aeropuerto Destino" value={e.aeropuerto_destino || PLACEHOLDER} />
      <DetailRow label="Aerolínea" value={e.aerolinea || PLACEHOLDER} />
      <DetailRow label="MAWB" value={e.mawb || PLACEHOLDER} />
      <DetailRow label="HAWB" value={e.hawb || PLACEHOLDER} />
    </>
  );
}

export function RutaTerrestre({ e }: { e: EmbarqueRow }) {
  return (
    <>
      <DetailRow label="Ciudad Origen" value={e.ciudad_origen || PLACEHOLDER} />
      <DetailRow label="Ciudad Destino" value={e.ciudad_destino || PLACEHOLDER} />
      <DetailRow label="Transportista" value={e.transportista || PLACEHOLDER} />
      <DetailRow label="Carta Porte" value={e.carta_porte || PLACEHOLDER} />
    </>
  );
}
