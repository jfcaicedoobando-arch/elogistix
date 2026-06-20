/**
 * Barra de filtros para /crm/leads.
 * - Desktop (md+): search + selects inline.
 * - Mobile (<md): search visible + botón "Filtros (N)" que abre Sheet.
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SearchInput from "@/components/shared/SearchInput";
import { MobileFiltersSheet } from "@/components/shared/MobileFiltersSheet";
import {
  LEAD_ESTADOS, LEAD_FUENTES,
  type CrmLeadEstado, type CrmLeadFuente,
} from "@/features/crm/hooks";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  estado: CrmLeadEstado | "todos";
  onEstadoChange: (v: CrmLeadEstado | "todos") => void;
  fuente: CrmLeadFuente | "todos";
  onFuenteChange: (v: CrmLeadFuente | "todos") => void;
}

export function LeadsFiltersBar({
  search, onSearchChange, estado, onEstadoChange, fuente, onFuenteChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = (estado !== "todos" ? 1 : 0) + (fuente !== "todos" ? 1 : 0);

  const clearAll = () => {
    onEstadoChange("todos");
    onFuenteChange("todos");
  };

  const EstadoSelect = (
    <Select value={estado} onValueChange={(v) => onEstadoChange(v as CrmLeadEstado | "todos")}>
      <SelectTrigger className="md:w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los estados</SelectItem>
        {LEAD_ESTADOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const FuenteSelect = (
    <Select value={fuente} onValueChange={(v) => onFuenteChange(v as CrmLeadFuente | "todos")}>
      <SelectTrigger className="md:w-[180px]"><SelectValue placeholder="Fuente" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todas las fuentes</SelectItem>
        {LEAD_FUENTES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardContent className="p-3">
        {/* Mobile */}
        <div className="flex gap-2 md:hidden">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Buscar..."
            className="flex-1 min-w-0"
          />
          <MobileFiltersSheet
            open={open}
            onOpenChange={setOpen}
            title="Filtros de leads"
            activeCount={activeCount}
            onClearAll={clearAll}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              {EstadoSelect}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fuente</label>
              {FuenteSelect}
            </div>
          </MobileFiltersSheet>
        </div>
        {/* Desktop */}
        <div className="hidden md:flex md:flex-row md:gap-3">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Buscar por empresa, contacto o email..."
          />
          {EstadoSelect}
          {FuenteSelect}
        </div>
      </CardContent>
    </Card>
  );
}
