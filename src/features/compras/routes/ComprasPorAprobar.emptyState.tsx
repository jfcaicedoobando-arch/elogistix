/**
 * Empty state para /compras/por-aprobar. Extraído para bajar la complejidad
 * ciclomática de la route principal.
 */
import { Inbox } from "lucide-react";

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
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
      <h3 className="text-base font-semibold">{TITULOS[aprobacion]}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{DESCRIPCIONES[aprobacion]}</p>
    </div>
  );
}
