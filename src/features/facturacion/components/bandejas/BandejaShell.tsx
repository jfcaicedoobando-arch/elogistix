/**
 * `<BandejaShell />` — layout compartido por las 7 bandejas del cockpit
 * de Facturación. Garantiza mismo design language en los 4 escenarios:
 *
 *   • Loading   → skeleton dentro del `DataTable` (via `isLoading`).
 *   • Vacío     → empty state con `emptyIcon` + `emptyMessage`.
 *   • Error     → `<ErrorState />` con "Reintentar" (mismo bloque que Clientes).
 *   • Con datos → tabla + paginación + contador "Mostrando X de Y".
 *
 * La barra de filtros (`UnifiedFiltersBar`) y el contador viven arriba de
 * la tabla y NO se ocultan en estado de error para no confundir al usuario.
 */
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import type { ChipItem } from "@/hooks/shared/useTableFilters";

export interface BandejaShellProps {
  /** Estado de la query madre (react-query). */
  isError?: boolean;
  onRetry?: () => void;

  /** Barra de búsqueda / chips (compartida con Cartera, CxP, Cotizaciones). */
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  chips: ChipItem[];
  activeCount: number;
  onClearAll: () => void;
  /** Slots opcionales de la barra (Select de moneda, estado, etc.). */
  primary?: ReactNode;
  secondary?: ReactNode;

  /** Contador "Mostrando X de Y (…)". */
  counter: ReactNode;

  /** Bloque de tabla (`<DataTable/>` envuelto en su Card). */
  children: ReactNode;
}

export function BandejaShell({
  isError = false,
  onRetry,
  search,
  onSearchChange,
  searchPlaceholder,
  chips,
  activeCount,
  onClearAll,
  primary,
  secondary,
  counter,
  children,
}: BandejaShellProps) {
  return (
    <div className="space-y-3">
      <UnifiedFiltersBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        primary={primary}
        secondary={secondary}
        chips={chips}
        activeCount={activeCount}
        onClearAll={onClearAll}
      />
      <div className="text-xs text-muted-foreground">{counter}</div>
      {isError ? (
        <Card>
          <CardContent className="p-0">
            <ErrorState
              className="m-4"
              title="No se pudo cargar la bandeja"
              description="Hubo un problema al consultar la base de datos. Intenta de nuevo en unos segundos."
              onRetry={onRetry}
            />
          </CardContent>
        </Card>
      ) : (
        children
      )}
    </div>
  );
}
