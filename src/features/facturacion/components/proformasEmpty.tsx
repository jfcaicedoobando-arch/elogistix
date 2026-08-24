/**
 * Estados vacíos del listado de proformas. Extraído de `TabProformas.tsx`
 * para mantener la complejidad del componente bajo el límite del linter
 * (Power of 10) sin cambiar el copy ni el comportamiento.
 */
import { FileSpreadsheet } from "lucide-react";
import EmptyState from "@/components/empty/EmptyState";


export function ProformasEmptyState({
  search,
  filtroEstado,
  onLimpiarBusqueda,
  onLimpiarFiltros,
}: {
  search: string;
  filtroEstado: string;
  onLimpiarBusqueda: () => void;
  onLimpiarFiltros: () => void;
}) {
  const q = search.trim();
  if (q) {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title={`Sin resultados para «${q}»`}
        description="Ajusta la búsqueda o límpiala para ver todas las proformas."
        primaryAction={{ label: "Limpiar búsqueda", onClick: onLimpiarBusqueda }}
      />
    );
  }
  if (filtroEstado === "aceptada") {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="Ninguna proforma aceptada pendiente de emitir"
        description="Cuando un cliente acepte una proforma, aparecerá aquí lista para convertirse en factura."
        primaryAction={{ label: "Limpiar filtros", onClick: onLimpiarFiltros }}
      />
    );
  }
  return (
    <EmptyState
      icon={FileSpreadsheet}
      title="No hay proformas con estos filtros"
      description="Ajusta o quita los filtros aplicados para ver el listado completo de proformas."
      primaryAction={{ label: "Limpiar filtros", onClick: onLimpiarFiltros }}
    />
  );
}
