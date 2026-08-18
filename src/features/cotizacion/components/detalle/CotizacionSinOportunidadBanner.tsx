/**
 * Aviso cuando una cotización de prospecto quedó sin oportunidad en el CRM.
 * Permite reintentar el vínculo (RPC transaccional) sin salir del detalle.
 * El envío de la cotización está bloqueado hasta que exista el vínculo
 * (`LC_COT_SIN_OPORTUNIDAD` desde la base de datos).
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Link2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { vincularOCrearOportunidadParaCotizacion } from "@/features/crm/services/vincularCotizacion";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

interface Props {
  cotizacionId: string;
  folio?: string | null;
  modoTransporte?: string | null;
  empresa: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  canEdit: boolean;
}

export function CotizacionSinOportunidadBanner({
  cotizacionId, folio, modoTransporte, empresa, contacto, email, telefono, canEdit,
}: Props) {
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState(false);

  const reintentar = async () => {
    setEnviando(true);
    try {
      await vincularOCrearOportunidadParaCotizacion({
        cotizacionId,
        cotizacionFolio: folio ?? undefined,
        modoTransporte: modoTransporte ?? "",
        prospecto: {
          empresa: empresa ?? "",
          contacto: contacto ?? "",
          email: email ?? "",
          telefono: telefono ?? "",
        },
        user: null,
      });
      notifySuccess("Cotización vinculada a una oportunidad del CRM");
      await queryClient.invalidateQueries({ queryKey: ["cotizacion", cotizacionId] });
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo vincular la cotización al CRM",
        error: err,
        method: "REINTENTAR_VINCULO_CRM",
        context: { cotizacionId },
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Sin oportunidad en el CRM</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span>
          Esta cotización no está ligada a una oportunidad, por lo que no se puede enviar al
          prospecto. Vincúlala para que el pipeline comercial refleje el avance.
        </span>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={reintentar} disabled={enviando}>
            <Link2 className="mr-2 h-4 w-4" />
            {enviando ? "Vinculando…" : "Vincular al CRM"}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
