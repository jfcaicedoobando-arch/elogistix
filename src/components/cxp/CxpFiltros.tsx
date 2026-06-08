/**
 * Filtros de CxP — barra compacta + chips de filtros activos.
 *
 * Desktop (md+): [ Search ][ Estatus ][ Moneda ][ Filtros (N) ]
 *   Sheet lateral con: Proveedor, Emisión desde, Emisión hasta.
 * Mobile: [ Search ][ Filtros (N) ] (sheet con todo).
 */
import { useMemo, useState } from "react";
import { Filter, X } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SearchInput from "@/components/selects/SearchInput";
import { useProveedoresLite } from "@/hooks/proveedor";
import type { EstatusCxP } from "@/services/cxp";
import { CxpFiltrosChips } from "./CxpFiltrosChips";

const ESTATUS: Array<EstatusCxP | "todos"> = ["todos", "Vigente", "Por vencer", "Vencida"];

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  estatus: EstatusCxP | "todos";
  onEstatusChange: (v: EstatusCxP | "todos") => void;
  moneda: "todas" | "MXN" | "USD" | "EUR";
  onMonedaChange: (v: "todas" | "MXN" | "USD" | "EUR") => void;
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
    (props.fechaDesde ? 1 : 0) +
    (props.fechaHasta ? 1 : 0);

  const totalActive =
    secondaryActive +
    (props.estatus !== "todos" ? 1 : 0) +
    (props.moneda !== "todas" ? 1 : 0);

  const clearAll = () => {
    props.onEstatusChange("todos");
    props.onMonedaChange("todas");
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
          <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px]">
            {count}
          </Badge>
        )}
      </Button>
    </SheetTrigger>
  );

  const SheetFields = ({ includePrimary }: { includePrimary: boolean }) => (
    <div className="space-y-4">
      {includePrimary && (
        <>
          <div className="space-y-1">
            <Label>Estatus</Label>
            <Select value={props.estatus} onValueChange={(v) => props.onEstatusChange(v as EstatusCxP | "todos")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTATUS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e === "todos" ? "Todos los estatus" : e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Moneda</Label>
            <Select value={props.moneda} onValueChange={(v) => props.onMonedaChange(v as typeof props.moneda)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      <div className="space-y-1">
        <Label>Proveedor</Label>
        <Select value={props.proveedorId || "todos"} onValueChange={props.onProveedorChange}>
          <SelectTrigger><SelectValue placeholder="Todos los proveedores" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="todos">Todos los proveedores</SelectItem>
            {proveedoresOpts.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Emisión desde</Label>
          <Input
            type="date" value={props.fechaDesde}
            onChange={(e) => props.onFechaDesdeChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Emisión hasta</Label>
          <Input
            type="date" value={props.fechaHasta}
            onChange={(e) => props.onFechaHastaChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-0">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        {/* Mobile */}
        <div className="flex gap-2 md:hidden">
          <SearchInput
            value={props.search} onChange={props.onSearchChange}
            placeholder="Buscar folio o proveedor..." className="flex-1 min-w-0"
          />
          <FilterButton count={totalActive} />
        </div>

        {/* Desktop */}
        <div className="hidden md:flex md:items-center md:gap-2">
          <SearchInput
            value={props.search} onChange={props.onSearchChange}
            placeholder="Buscar folio o proveedor..." className="flex-1 min-w-[220px]"
          />
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
          <FilterButton count={secondaryActive} />
        </div>

        <SheetContent side="right" className="w-full max-w-sm flex flex-col gap-0 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Filtros de CxP</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="md:hidden">
              <SheetFields includePrimary />
            </div>
            <div className="hidden md:block">
              <SheetFields includePrimary={false} />
            </div>
          </div>
          <SheetFooter className="p-4 border-t flex-row gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="ghost" onClick={clearAll}
              disabled={totalActive === 0} className="gap-2"
            >
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
