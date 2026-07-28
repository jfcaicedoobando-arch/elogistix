import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { ROUTES } from "@/constants/routes";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { toTitleCase } from "@/lib/formatters";

interface PortalCotizacionHeaderProps {
  folio: string;
  estado: string;
  clienteNombre: string;
  onAceptar: () => void;
  onRechazar: () => void;
}

/**
 * Header canónico del detalle de cotización del portal cliente.
 * v13.320.66 — migrado a `DetailHeader` (botón Volver integrado como enlace
 * real). En mobile las acciones de aceptar/rechazar siguen apareciendo como
 * action bar sticky en el bottom (por encima del PortalBottomNav, `bottom-16`).
 */
export default function PortalCotizacionHeader({
  folio,
  estado,
  clienteNombre,
  onAceptar,
  onRechazar,
}: PortalCotizacionHeaderProps) {
  const showActions = estado === "Enviada";

  return (
    <>
      <DetailHeader
        backTo={ROUTES.PORTAL_COTIZACIONES}
        backLabel="Cotizaciones"
        icon={<ClipboardList className="h-6 w-6 text-accent shrink-0" />}
        title={<span className="font-mono tabular-nums">{folio}</span>}
        subtitle={toTitleCase(clienteNombre)}
        badge={<Badge className={getEstadoColor(estado)}>{estado}</Badge>}
        trailing={
          showActions ? (
            <div className="hidden md:flex gap-2">
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={onRechazar}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rechazar
              </Button>
              <Button
                className="bg-success text-success-foreground hover:bg-success/90"
                onClick={onAceptar}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aceptar Cotización
              </Button>
            </div>
          ) : undefined
        }
      />


      {showActions && (
        <div className="md:hidden fixed bottom-16 inset-x-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 px-4 py-3">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Button
              variant="outline"
              className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
              onClick={onRechazar}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rechazar
            </Button>
            <Button
              className="flex-1 bg-success text-success-foreground hover:bg-success/90"
              onClick={onAceptar}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aceptar
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
