/**
 * Card con búsqueda + filtros de la vista de Oportunidades.
 *
 * v13.823.49 — El sheet móvil y el collapsible de escritorio compartían un
 * único estado (`filtersOpen`), así que abrir los filtros en desktop también
 * abría el sheet (dos paneles y dos botones "Limpiar"). Ahora el sheet tiene
 * su propio estado local y sólo se monta en móvil.
 */
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileFiltersSheet } from "@/components/shared/MobileFiltersSheet";
import SearchInput from "@/components/shared/SearchInput";
import OportunidadesFiltersBar from "@/features/crm/components/OportunidadesFiltersBar";
import OportunidadesViewChips from "@/features/crm/components/OportunidadesViewChips";
import { FILTROS_DEFAULT, type OportunidadesFiltros } from "@/features/crm/components/oportunidadesFiltersTypes";
import { useIsMobile } from "@/hooks/shared/useIsMobile";
import type { CrmEtapaRow } from "@/features/crm/hooks";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  filtros: OportunidadesFiltros;
  onFiltrosChange: (v: OportunidadesFiltros) => void;
  /** Estado del panel de escritorio (colapsable). */
  filtersOpen: boolean;
  onFiltersOpenChange: (v: boolean) => void;
  etapas: CrmEtapaRow[];
  vendedores: { id: string; email: string }[];
  activos: number;
}

export default function OportunidadesFiltersSection({
  search, onSearchChange, filtros, onFiltrosChange,
  filtersOpen, onFiltersOpenChange, etapas, vendedores, activos,
}: Props) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <OportunidadesViewChips value={filtros} onChange={onFiltrosChange} />
        {/* Mobile */}
        <div className="flex gap-2 md:hidden">
          <div className="flex-1 min-w-0">
            <SearchInput value={search} onChange={onSearchChange} placeholder="Buscar…" />
          </div>
          {isMobile && (
            <MobileFiltersSheet
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              title="Filtros de oportunidades"
              activeCount={activos}
              onClearAll={() => onFiltrosChange(FILTROS_DEFAULT)}
            >
              <OportunidadesFiltersBar
                etapas={etapas}
                vendedores={vendedores}
                value={filtros}
                onChange={onFiltrosChange}
              />
            </MobileFiltersSheet>
          )}
        </div>
        {/* Desktop */}
        <div className="hidden md:flex md:flex-row md:gap-2 md:items-center">
          <div className="flex-1">
            <SearchInput value={search} onChange={onSearchChange} placeholder="Buscar por nombre o cliente…" />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            aria-expanded={filtersOpen}
            onClick={() => onFiltersOpenChange(!filtersOpen)}
          >
            {filtersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Filtros
            {activos > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-label">{activos}</Badge>}
          </Button>
        </div>
        {filtersOpen && (
          <div className="hidden md:block space-y-2">
            <OportunidadesFiltersBar
              etapas={etapas}
              vendedores={vendedores}
              value={filtros}
              onChange={onFiltrosChange}
            />
            {activos > 0 && (
              <Button variant="ghost" size="sm" onClick={() => onFiltrosChange(FILTROS_DEFAULT)}>
                Limpiar filtros
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
