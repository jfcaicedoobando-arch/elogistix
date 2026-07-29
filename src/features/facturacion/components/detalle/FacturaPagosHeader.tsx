/**
 * Encabezado de la sección "Historial de pagos" con badge de estado.
 * Extraído de `FacturaPagosSection` para bajar su complejidad ciclomática.
 */
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";

interface Props {
  hayPagos: boolean;
  liquidada: boolean;
}

export function FacturaPagosHeader({ hayPagos, liquidada }: Props) {
  return (
    <CardHeader className="flex-row items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" /> Historial de pagos
        </CardTitle>
        {hayPagos && (
          <Badge variant={liquidada ? "default" : "secondary"} className="gap-1">
            {liquidada ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {liquidada ? "Liquidada" : "Saldo pendiente"}
          </Badge>
        )}
      </div>
    </CardHeader>
  );
}
