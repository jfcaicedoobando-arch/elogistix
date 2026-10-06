import { Link } from "react-router";
import { useCotizacion } from "@/features/cotizacion/hooks";
import { DetailRow } from "../DetailRow";

/** Datos comerciales de origen, sólo lectura. No inventa un equipo operativo. */
export function DatosTerrestresCotizados({ cotizacionId }: { cotizacionId: string }) {
  const { data: cotizacion, isLoading, isError } = useCotizacion(cotizacionId);
  if (isLoading) return <p role="status" className="text-body-sm text-muted-foreground">Cargando equipo cotizado…</p>;
  if (isError || !cotizacion) return <p role="status" className="text-body-sm text-warning">No se pudo consultar el equipo de la cotización vinculada.</p>;
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-body-sm text-muted-foreground">
        Datos cotizados · <Link className="text-primary underline" to={`/cotizaciones/${cotizacionId}`}>{cotizacion.folio}</Link>
        {" "}(origen comercial, no asignación de vehículo)
      </p>
      <DetailRow label="Equipo cotizado" value={cotizacion.modalidad_equipo || "Sin especificar"} />
      {cotizacion.tipo_unidad && <DetailRow label="Unidad cotizada" value={cotizacion.tipo_unidad} />}
      {cotizacion.punto_intermedio && <DetailRow label="Punto intermedio cotizado" value={cotizacion.punto_intermedio} />}
    </div>
  );
}
