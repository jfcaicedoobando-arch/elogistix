/**
 * Card con búsqueda + filtros colapsables (mobile sheet / desktop collapsible)
 * de la vista de Oportunidades.
 */
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MobileFiltersSheet } from "@/components/shared/MobileFiltersSheet";
import SearchInput from "@/components/shared/SearchInput";
import OportunidadesFiltersBar from "@/features/crm/components/OportunidadesFiltersBar";
import OportunidadesViewChips from "@/features/crm/components/OportunidadesViewChips";
import { FILTROS_DEFAULT, type OportunidadesFiltros } from "@/features/crm/components/oportunidadesFiltersTypes";
import type { CrmEtapaRow } from "@/features/crm/hooks";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  filtros: OportunidadesFiltros;
  onFiltrosChange: (v: OportunidadesFiltros) => void;
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
  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <OportunidadesViewChips value={filtros} onChange={onFiltrosChange} />
        {/* Mobile */}
        <div className="flex gap-2 md:hidden">
          <div className="flex-1 min-w-0">
            <SearchInput value={search} onChange={onSearchChange} placeholder="Buscar…" />
          </div>
          <MobileFiltersSheet
            open={filtersOpen}
            onOpenChange={onFiltersOpenChange}
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
        </div>
        {/* Desktop */}
        <div className="hidden md:flex md:flex-row md:gap-2 md:items-center">
          <div className="flex-1">
            <SearchInput value={search} onChange={onSearchChange} placeholder="Buscar por nombre o cliente…" />
          </div>
          <Collapsible open={filtersOpen} onOpenChange={onFiltersOpenChange}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                {filtersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Filtros
                {activos > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-2xs">{activos}</Badge>}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
        {filtersOpen && (
          <div className="hidden md:block">
            <OportunidadesFiltersBar
              etapas={etapas}
              vendedores={vendedores}
              value={filtros}
              onChange={onFiltrosChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
