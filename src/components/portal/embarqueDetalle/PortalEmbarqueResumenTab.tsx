import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, getOrigen, getDestino } from "@/lib/formatters";
import type { Embarque } from "@/types/embarque";

interface Props {
  embarque: Embarque;
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
            {embarque.contenedor && <>
              <dt className="text-muted-foreground">Contenedor</dt>
              <dd className="font-medium">{embarque.contenedor}</dd>
            </>}
            {embarque.bl_master && <>
              <dt className="text-muted-foreground">BL Master</dt>
              <dd className="font-medium">{embarque.bl_master}</dd>
            </>}
            {embarque.bl_house && <>
              <dt className="text-muted-foreground">BL House</dt>
              <dd className="font-medium">{embarque.bl_house}</dd>
            </>}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
