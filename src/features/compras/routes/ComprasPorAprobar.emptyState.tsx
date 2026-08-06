/**
 * Empty state para /compras/por-aprobar. Extraído para bajar la complejidad
 * ciclomática de la route principal.
 */
import { Inbox } from "lucide-react";
import EmptyState from "@/components/empty/EmptyState";

type AprobacionFiltro = "pendiente" | "aprobada" | "rechazada";

const TITULOS: Record<AprobacionFiltro, string> = {
  pendiente: "No hay solicitudes pendientes",
  aprobada: "No hay facturas aprobadas",
  rechazada: "No hay facturas rechazadas",
};

const DESCRIPCIONES: Record<AprobacionFiltro, string> = {
  pendiente:
    "Todas las facturas capturadas están al día. Cuando llegue una nueva solicitud aparecerá aquí.",
  aprobada: "Cambia de pestaña o ajusta la búsqueda para ver otros estados.",
  rechazada: "Cambia de pestaña o ajusta la búsqueda para ver otros estados.",
};

export function ComprasPorAprobarEmptyState({ aprobacion }: { aprobacion: AprobacionFiltro }) {
  return (
    <EmptyState
      icon={Inbox}
      title={TITULOS[aprobacion]}
      description={DESCRIPCIONES[aprobacion]}
    />
  );
}
