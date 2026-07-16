import { Info, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  mismoDia: boolean;
  montoBajo: boolean;
  rfcGenerico: boolean;
  requiereAceptacion: boolean;
}

/**
 * Banners informativos de la regla SAT 2.7.1.34 (RMF 2022+):
 * mismo día / monto ≤1000 / RFC genérico exentan aceptación del receptor.
 */
export function BannersCondicionesSAT({ mismoDia, montoBajo, rfcGenerico, requiereAceptacion }: Props) {
  if (mismoDia) {
    return (
      <Alert className="border-success/30 bg-success/10">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <AlertTitle className="text-success">Ventana de cancelación inmediata</AlertTitle>
        <AlertDescription className="text-foreground">
          Esta factura se emitió hoy. El SAT permite cancelarla sin aceptación del receptor.
        </AlertDescription>
      </Alert>
    );
  }
  if (requiereAceptacion) {
    return (
      <Alert className="border-warning/30 bg-warning/10">
        <Info className="h-4 w-4 text-warning" />
        <AlertTitle className="text-warning">El receptor debe aceptar la cancelación</AlertTitle>
        <AlertDescription className="text-foreground space-y-1">
          <p>
            Por regla SAT 2.7.1.34, esta factura requiere que el cliente <strong>acepte la cancelación
            en su Buzón Tributario</strong>. Timbrar la sustituta (relación 04) no exenta este paso.
          </p>
          <p className="text-xs">Si no responde en 72 horas hábiles aplica cancelación por silencio positivo.</p>
        </AlertDescription>
      </Alert>
    );
  }
  if (montoBajo || rfcGenerico) {
    return (
      <Alert className="border-success/30 bg-success/10">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <AlertTitle className="text-success">Cancelación sin aceptación</AlertTitle>
        <AlertDescription className="text-foreground">
          {montoBajo && "Monto ≤ $1,000 MXN: exenta de aceptación del receptor."}
          {rfcGenerico && "RFC genérico: exenta de aceptación del receptor."}
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
