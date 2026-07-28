import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatNumber, getOrigen, getDestino } from "@/lib/formatters";

/** Fila `dt`/`dd` que sólo se pinta cuando hay valor. */
function Dato({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </>
  );
}

/** B-102: datos operativos (carga y documentos) del embarque. */
function DatosOperativos({ embarque }: { embarque: EmbarqueResumen }) {
  const num = (v?: number | null, sufijo = "") =>
    v != null && v > 0 ? `${formatNumber(v)}${sufijo}` : null;
  return (
    <>
      <Dato label="Tipo de contenedor" value={embarque.tipo_contenedor ?? null} />
      <Dato label="Peso" value={num(embarque.peso_kg, " kg")} />
      <Dato label="Volumen" value={num(embarque.volumen_m3, " m³")} />
      <Dato label="Piezas" value={num(embarque.piezas)} />
      <Dato label="Contenedor" value={embarque.contenedor ?? null} />
      <Dato label="BL Master" value={embarque.bl_master ?? null} />
      <Dato label="BL House" value={embarque.bl_house ?? null} />
    </>
  );
}

type EmbarqueResumen = Parameters<typeof getOrigen>[0] &
  Parameters<typeof getDestino>[0] & {
    etd?: string | null;
    eta?: string | null;
    naviera?: string | null;
    aerolinea?: string | null;
    transportista?: string | null;
    modo: string;
    tipo: string;
    incoterm: string;
    descripcion_mercancia?: string | null;
    tipo_contenedor?: string | null;
    peso_kg?: number | null;
    volumen_m3?: number | null;
    piezas?: number | null;
    contenedor?: string | null;
    bl_master?: string | null;
    bl_house?: string | null;
  };

interface Props {
  embarque: EmbarqueResumen;
}

export function PortalEmbarqueResumenTab({ embarque }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Datos de Ruta</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Origen</dt>
            <dd className="font-medium">{getOrigen(embarque)}</dd>
            <dt className="text-muted-foreground">Destino</dt>
            <dd className="font-medium">{getDestino(embarque)}</dd>
            <dt className="text-muted-foreground">ETD</dt>
            <dd className="font-medium">{embarque.etd ? formatDate(embarque.etd) : "—"}</dd>
            <dt className="text-muted-foreground">ETA</dt>
            <dd className="font-medium">{embarque.eta ? formatDate(embarque.eta) : "—"}</dd>
            {embarque.naviera && <>
              <dt className="text-muted-foreground">Naviera</dt>
              <dd className="font-medium">{embarque.naviera}</dd>
            </>}
            {embarque.aerolinea && <>
              <dt className="text-muted-foreground">Aerolínea</dt>
              <dd className="font-medium">{embarque.aerolinea}</dd>
            </>}
            {embarque.transportista && <>
              <dt className="text-muted-foreground">Transportista</dt>
              <dd className="font-medium">{embarque.transportista}</dd>
            </>}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Datos Generales</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Modo</dt>
            <dd className="font-medium">{embarque.modo}</dd>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd className="font-medium">{embarque.tipo}</dd>
            <dt className="text-muted-foreground">Incoterm</dt>
            <dd className="font-medium">{embarque.incoterm}</dd>
            <dt className="text-muted-foreground">Mercancía</dt>
            <dd className="font-medium">{embarque.descripcion_mercancia || "—"}</dd>
            {/* B-102: datos operativos que ya vienen en la query del detalle. */}
            <DatosOperativos embarque={embarque} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
