/**
 * Badge del estatus que reporta el servicio público de consulta del SAT.
 */
import { Badge } from "@/components/ui/badge";
import type { EstatusSatConsulta } from "@/features/facturacion/services/facturapi";

const VARIANTE: Record<EstatusSatConsulta, "default" | "secondary" | "destructive" | "outline"> = {
  Vigente: "default",
  Cancelado: "destructive",
  "No encontrado": "destructive",
  "No verificable": "outline",
  Error: "secondary",
};

export function ConsultaSatBadge({ estatus }: { estatus: EstatusSatConsulta }) {
  return <Badge variant={VARIANTE[estatus] ?? "outline"}>SAT: {estatus}</Badge>;
}
