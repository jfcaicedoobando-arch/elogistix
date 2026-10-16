/**
 * Filtros de CxP — barra compacta + chips de filtros activos.
 */
import { useMemo } from "react";
import { Filter, X } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SearchInput from "@/components/shared/SearchInput";
import { useProveedoresLite } from "@/features/proveedor/hooks";
import { usePresupuestoCategorias } from "@/features/presupuesto/hooks";
import type { EstatusCxP } from "@/features/cxp/services";
import { CxpFiltrosChips } from "./CxpFiltrosChips";
import { CxpFiltrosSheetFields } from "./CxpFiltrosSheetFields";
import { mobileFilterSheet } from "@/components/shared/utils/dialogTokens";
import type { Moneda } from "@/types/db";
import { useCxpFiltrosDraft } from "../hooks/useCxpFiltrosDraft";

export interface CxpFiltrosProps {
  search: string;
  onSearchChange: (v: string) => void;
  estatus: EstatusCxP | "todos";
  onEstatusChange: (v: EstatusCxP | "todos") => void;
  moneda: "todas" | Moneda;
  onMonedaChange: (v: "todas" | Moneda) => void;
  origen: "Nacional" | "Extranjero" | "todos";
  onOrigenChange: (v: "Nacional" | "Extranjero" | "todos") => void;
  aprobacion: "todos" | "pendiente" | "aprobada" | "rechazada";
  onAprobacionChange: (v: "todos" | "pendiente" | "aprobada" | "rechazada") => void;
  proveedorId: string;
  onProveedorChange: (v: string) => void;
  categoriaPresupuestoId: string;
  onCategoriaPresupuestoChange: (v: string) => void;
  fechaDesde: string;
  onFechaDesdeChange: (v: string) => void;
  fechaHasta: string;
  onFechaHastaChange: (v: string) => void;
}

export function CxpFiltros(props: CxpFiltrosProps) {
  const draft = useCxpFiltrosDraft(props);
  const { data: proveedores = [] } = useProveedoresLite();
  const { data: categorias = [] } = usePresupuestoCategorias();

  const proveedoresOpts = useMemo(
    () => proveedores.map((p) => ({ id: p.id, nombre: p.nombre })),
    [proveedores],
  );
  const categoriasOpts = useMemo(
    () => categorias.map((c) => ({ id: c.id, nombre: c.nombre })),
    [categorias],
  );

  const secondaryActive =
    (props.proveedorId && props.proveedorId !== "todos" ? 1 : 0) +
    (props.categoriaPresupuestoId && props.categoriaPresupuestoId !== "todas" ? 1 : 0) +
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
    props.onCategoriaPresupuestoChange("todas");
    props.onFechaDesdeChange("");
    props.onFechaHastaChange("");
  };

  const FilterButton = ({ count }: { count: number }) => (
    <SheetTrigger asChild>
      <Button variant="outline" size="default" className="shrink-0 gap-2">
        <Filter className="h-4 w-4" />
        <span>Filtros</span>
        {count > 0 && (
          <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-label">{count}</Badge>
        )}
      </Button>
    </SheetTrigger>
  );

  return (
    <div className="space-y-0">
      <Sheet open={draft.open} onOpenChange={draft.onOpenChange}>
        <div className="flex gap-2 md:hidden">
          <SearchInput value={props.search} onChange={props.onSearchChange}
            placeholder="Buscar folio o proveedor…" className="flex-1 min-w-0" />
          <FilterButton count={totalActive} />
        </div>

        <div className="hidden md:flex md:items-center md:gap-2 md:flex-wrap">
          <SearchInput value={props.search} onChange={props.onSearchChange}
            placeholder="Buscar folio o proveedor…" className="flex-1 min-w-[220px]" />
          <div className="flex flex-col gap-0.5 shrink-0">
            <span className="px-1 text-overline text-muted-foreground short:sr-only">Origen</span>
            <div className="flex gap-1 rounded-md border bg-background p-0.5">
              {(['todos', 'Nacional', 'Extranjero'] as const).map((opt) => (
                <Button key={opt} type="button"
                  variant={props.origen === opt ? "default" : "ghost"}
                  size="sm" className="h-8 px-3 text-body-sm"
                  onClick={() => props.onOrigenChange(opt)}>
                  {opt === 'todos' ? 'Todos' : opt}
                </Button>
              ))}
            </div>
          </div>
          <FilterButton count={totalActive - (props.origen !== "todos" ? 1 : 0)} />
        </div>

        <SheetContent side="right" className={mobileFilterSheet}>
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Filtros de CxP</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <CxpFiltrosSheetFields
              includePrimary
              {...draft.values}
              onEstatusChange={(v) => draft.update("estatus", v)}
              onMonedaChange={(v) => draft.update("moneda", v)}
              onAprobacionChange={(v) => draft.update("aprobacion", v)}
              onProveedorChange={(v) => draft.update("proveedorId", v)}
              onCategoriaPresupuestoChange={(v) => draft.update("categoriaPresupuestoId", v)}
              onFechaDesdeChange={(v) => draft.update("fechaDesde", v)}
              onFechaHastaChange={(v) => draft.update("fechaHasta", v)}
              proveedoresOpts={proveedoresOpts}
              categoriasOpts={categoriasOpts}
            />
          </div>
          <SheetFooter className="p-4 border-t flex-row flex-wrap gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={draft.clear} disabled={!draft.active} className="gap-2">
              <X className="h-4 w-4" /> Limpiar
            </Button>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => draft.onOpenChange(false)}>Cancelar</Button>
              <Button onClick={draft.apply}>Aplicar</Button>
            </div>
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
        categoriaPresupuestoId={props.categoriaPresupuestoId}
        onCategoriaPresupuestoChange={props.onCategoriaPresupuestoChange}
        fechaDesde={props.fechaDesde}
        onFechaDesdeChange={props.onFechaDesdeChange}
        fechaHasta={props.fechaHasta}
        onFechaHastaChange={props.onFechaHastaChange}
        proveedores={proveedoresOpts}
        categorias={categoriasOpts}
        onClearAll={clearAll}
      />
    </div>
  );
}
