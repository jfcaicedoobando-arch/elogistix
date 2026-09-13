/**
 * Aviso cuando una cotización de prospecto quedó sin oportunidad en el CRM.
 *
 * P0 (cotizaciones huérfanas): ya NO se reintenta el vínculo "adivinando" el
 * prospecto por nombre/correo. La corrección es manual: se abre el wizard para
 * elegir el prospecto u oportunidad real del CRM. El envío sigue bloqueado
 * hasta que exista el vínculo (`LC_COT_SIN_OPORTUNIDAD` desde la base).
 */
import { Link } from "react-router-dom";
import { AlertTriangle, Link2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Props {
  cotizacionId: string;
  /**
   * v13.823.349 — capacidad de ESCRITURA de cotizaciones (SALES). Antes llegaba
   * el `canEdit` amplio y finanzas/lectura veían "Editar y vincular" aunque el
   * formulario y la RPC las rechazan.
   */
  canWriteCotizaciones: boolean;
  /**
   * v13.823.355 — sólo Borrador/Solicitada son editables. En cualquier otro
   * estado el CTA "Editar y vincular" prometía una acción que el wizard
   * rechaza, dejando al usuario sin salida.
   */
  estadoCotizacion?: string | null;
}

/** Estados en los que el wizard sí permite editar y vincular. */
const ESTADOS_EDITABLES = ["Borrador", "Solicitada"];

export function CotizacionSinOportunidadBanner({
  cotizacionId, canWriteCotizaciones, estadoCotizacion,
}: Props) {
  const editable = ESTADOS_EDITABLES.includes(String(estadoCotizacion ?? "Borrador"));
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Sin oportunidad en el CRM</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span>
          {editable
            ? "Esta cotización no está ligada a una oportunidad, por lo que no se puede enviar al prospecto. Edítala y vincúlala a un prospecto u oportunidad del CRM."
            : "Esta cotización no está ligada a una oportunidad y su estado ya no permite editarla. Duplícala para capturar el vínculo con el prospecto u oportunidad del CRM."}
        </span>
        {canWriteCotizaciones && editable && (

          <Button size="sm" variant="outline" asChild>
            <Link to={`/cotizaciones/${cotizacionId}/editar`}>
              <Link2 className="mr-2 h-4 w-4" />
              Editar y vincular
            </Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
