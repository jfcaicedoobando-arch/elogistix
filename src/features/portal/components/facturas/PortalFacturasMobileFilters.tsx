/**
 * Filtros mobile para la página de Mis Facturas del portal.
 * Search input siempre visible + botón "Filtros" que abre un Sheet con estado.
 */
import { useState } from "react";
import { Filter, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { mobileFilterSheet } from "@/components/shared/utils/dialogTokens";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  estados: string[];
  filtroEstado: string;
  setFiltroEstado: (v: string) => void;
}

export function PortalFacturasMobileFilters({
  search,
  onSearchChange,
  estados,
  filtroEstado,
  setFiltroEstado,
}: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = filtroEstado !== "todos" ? 1 : 0;

  const clearAll = () => setFiltroEstado("todos");

  return (
    <div className="flex gap-2 sm:hidden">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="shrink-0 gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {activeCount > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px]">
                {activeCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className={mobileFilterSheet}>
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Filtros de facturas</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger>
                  <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="p-4 border-t flex-row gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={clearAll} disabled={activeCount === 0} className="gap-2">
              <X className="h-4 w-4" /> Limpiar
            </Button>
            <Button onClick={() => setOpen(false)}>Aplicar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
