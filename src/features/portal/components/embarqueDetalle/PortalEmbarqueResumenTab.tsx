import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, getOrigen, getDestino } from "@/lib/formatters";

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
