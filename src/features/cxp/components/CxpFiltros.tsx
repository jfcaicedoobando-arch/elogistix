/**
 * Filtros de CxP — barra compacta + chips de filtros activos.
 */
import { useMemo, useState } from "react";
import { Filter, X } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SearchInput from "@/components/shared/SearchInput";
import { useProveedoresLite } from "@/features/proveedor/hooks";
import type { EstatusCxP } from "@/features/cxp/services";
import { CxpFiltrosChips } from "./CxpFiltrosChips";
import { CxpFiltrosSheetFields, ESTATUS } from "./CxpFiltrosSheetFields";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  estatus: EstatusCxP | "todos";
  onEstatusChange: (v: EstatusCxP | "todos") => void;
  moneda: "todas" | "MXN" | "USD" | "EUR";
  onMonedaChange: (v: "todas" | "MXN" | "USD" | "EUR") => void;
  origen: "Nacional" | "Extranjero" | "todos";
  onOrigenChange: (v: "Nacional" | "Extranjero" | "todos") => void;
  aprobacion: "todos" | "pendiente" | "aprobada" | "rechazada";
  onAprobacionChange: (v: "todos" | "pendiente" | "aprobada" | "rechazada") => void;
  proveedorId: string;
  onProveedorChange: (v: string) => void;
  fechaDesde: string;
  onFechaDesdeChange: (v: string) => void;
  fechaHasta: string;
  onFechaHastaChange: (v: string) => void;
}

export function CxpFiltros(props: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: proveedores = [] } = useProveedoresLite();

  const proveedoresOpts = useMemo(
    () => proveedores.map((p) => ({ id: p.id, nombre: p.nombre })),
    [proveedores],
  );

  const secondaryActive =
    (props.proveedorId && props.proveedorId !== "todos" ? 1 : 0) +
    (props.fechaDesde ? 1 : 0) + (props.fechaHasta ? 1 : 0);

  const totalActive =
    secondaryActive +
    (props.estatus !== "todos" ? 1 : 0) +
    (props.moneda !== "todas" ? 1 : 0) +
    (props.origen !== "todos" ? 1 : 0) +
    (props.aprobacion !== "todos" ? 1 : 0);

  const clearAll = () => {
    props.onEstatusChange("todos");
    props.onMonedaChange("todas");
    props.onOrigenChange("todos");
    props.onAprobacionChange("todos");
    props.onProveedorChange("todos");
    props.onFechaDesdeChange("");
    props.onFechaHastaChange("");
  };

  const FilterButton = ({ count }: { count: number }) => (
    <SheetTrigger asChild>
      <Button variant="outline" size="default" className="shrink-0 gap-2">
        <Filter className="h-4 w-4" />
        <span>Filtros</span>
        {count > 0 && (
          <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px]">{count}</Badge>
        )}
      </Button>
    </SheetTrigger>
  );

  return (
    <div className="space-y-0">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <div className="flex gap-2 md:hidden">
          <SearchInput value={props.search} onChange={props.onSearchChange}
            placeholder="Buscar folio o proveedor..." className="flex-1 min-w-0" />
          <FilterButton count={totalActive} />
        </div>

        <div className="hidden md:flex md:items-center md:gap-2 md:flex-wrap">
          <SearchInput value={props.search} onChange={props.onSearchChange}
            placeholder="Buscar folio o proveedor..." className="flex-1 min-w-[220px]" />
          <div className="flex gap-1 rounded-md border bg-background p-0.5 shrink-0">
            {(['todos', 'Nacional', 'Extranjero'] as const).map((opt) => (
              <Button key={opt} type="button"
                variant={props.origen === opt ? "default" : "ghost"}
                size="sm" className="h-8 px-3 text-xs"
                onClick={() => props.onOrigenChange(opt)}>
                {opt === 'todos' ? 'Todos' : opt}
              </Button>
            ))}
          </div>
          <Select value={props.estatus} onValueChange={(v) => props.onEstatusChange(v as EstatusCxP | "todos")}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ESTATUS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e === "todos" ? "Todos los estatus" : e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={props.moneda} onValueChange={(v) => props.onMonedaChange(v as typeof props.moneda)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1 rounded-md border bg-background p-0.5 shrink-0">
            {([
              { v: 'todos', l: 'Todas' },
              { v: 'pendiente', l: 'Por aprobar' },
              { v: 'aprobada', l: 'Aprobadas' },
              { v: 'rechazada', l: 'Rechazadas' },
            ] as const).map(({ v, l }) => (
              <Button key={v} type="button"
                variant={props.aprobacion === v ? "default" : "ghost"}
                size="sm" className="h-8 px-3 text-xs"
                onClick={() => props.onAprobacionChange(v)}>
                {l}
              </Button>
            ))}
          </div>
          <FilterButton count={secondaryActive} />
        </div>

        <SheetContent side="right" className="w-full max-w-sm flex flex-col gap-0 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Filtros de CxP</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="md:hidden">
              <CxpFiltrosSheetFields includePrimary {...props} proveedoresOpts={proveedoresOpts} />
            </div>
            <div className="hidden md:block">
              <CxpFiltrosSheetFields includePrimary={false} {...props} proveedoresOpts={proveedoresOpts} />
            </div>
          </div>
          <SheetFooter className="p-4 border-t flex-row gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={clearAll} disabled={totalActive === 0} className="gap-2">
              <X className="h-4 w-4" /> Limpiar
            </Button>
            <Button onClick={() => setSheetOpen(false)}>Aplicar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <CxpFiltrosChips
        estatus={props.estatus}
        onEstatusChange={(v) => props.onEstatusChange(v as EstatusCxP | "todos")}
        moneda={props.moneda}
        onMonedaChange={(v) => props.onMonedaChange(v as typeof props.moneda)}
        origen={props.origen}
        onOrigenChange={(v) => props.onOrigenChange(v as "Nacional" | "Extranjero" | "todos")}
        proveedorId={props.proveedorId}
        onProveedorChange={props.onProveedorChange}
        fechaDesde={props.fechaDesde}
        onFechaDesdeChange={props.onFechaDesdeChange}
        fechaHasta={props.fechaHasta}
        onFechaHastaChange={props.onFechaHastaChange}
        proveedores={proveedoresOpts}
        onClearAll={clearAll}
      />
    </div>
  );
}
