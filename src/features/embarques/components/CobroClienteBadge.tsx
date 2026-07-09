/**
 * Badge que muestra el estado de cobro al cliente de un embarque.
 * Es una dimensión independiente del estado operativo:
 * refleja el pago de facturas ligadas al embarque via `factura_embarques`.
 */
import { Badge } from "@/components/ui/badge";
import { CircleDollarSign } from "lucide-react";

type CobroStatus = "pendiente" | "parcial" | "pagado" | null | undefined;

interface Props {
  status: CobroStatus;
}

const LABEL: Record<Exclude<CobroStatus, null | undefined>, string> = {
  pendiente: "Cobro pendiente",
  parcial: "Cobro parcial",
  pagado: "Cobrado",
};

export function CobroClienteBadge({ status }: Props) {
  if (!status || status === "pendiente") {
    // No mostramos badge cuando aún no hay ningún avance de cobro,
    // para no saturar el header con un estado "default".
    return null;
  }
  const variant: "secondary" | "success" = status === "pagado" ? "success" : "secondary";
  return (
    <Badge variant={variant} className="gap-1" title="Cobro al cliente (facturas ligadas)">
      <CircleDollarSign className="h-3 w-3" />
      {LABEL[status]}
    </Badge>
  );
}
