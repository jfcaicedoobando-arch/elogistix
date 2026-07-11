import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { toTitleCase } from "@/lib/formatters";

interface PortalCotizacionHeaderProps {
  folio: string;
  estado: string;
  clienteNombre: string;
  onBack: () => void;
  onAceptar: () => void;
  onRechazar: () => void;
}

/**
 * Header canónico del detalle de cotización del portal cliente.
 * Usa `PageHeader` con icono y subHeader (badge de estado) — paridad
 * con los detalles de Embarque y Factura tras Lote 6.
 * En mobile las acciones de aceptar/rechazar aparecen como action bar
 * sticky en el bottom (por encima del PortalBottomNav, `bottom-16`).
 */
export default function PortalCotizacionHeader({
  folio,
  estado,
  clienteNombre,
  onBack,
  onAceptar,
  onRechazar,
}: PortalCotizacionHeaderProps) {
  const showActions = estado === "Enviada";

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="-ml-2 mb-1"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      <PageHeader
        icon={<ClipboardList className="h-6 w-6 text-accent" />}
        title={<span className="font-mono tabular-nums">{folio}</span>}
        description={toTitleCase(clienteNombre)}
        subHeader={
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getEstadoColor(estado)}>{estado}</Badge>
          </div>
        }
        actions={
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
