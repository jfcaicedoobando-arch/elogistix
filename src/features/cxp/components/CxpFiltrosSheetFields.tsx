/**
 * Campos secundarios del sheet de filtros CxP. Reutilizado por mobile (con primarios)
 * y desktop (sólo secundarios).
 */
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { EstatusCxP } from "@/features/cxp/services";
import { rangoLabel } from "@/lib/ui/rangoFechasCopy";
import type { Moneda } from "@/types/db";

// v13.307.16 — "Rechazada" y "Por aprobar" viven ahora en el estatus
// primario (celda `<EstadoFacturaCxPCell />`), por lo que el sheet expone
// los siete estatus canónicos + "Cancelada" en un solo combobox.
const ESTATUS: Array<EstatusCxP | "todos"> = [
  "todos",
  "Por aprobar",
  "Vigente",
  "Parcial",
  "Por vencer",
  "Vencida",
  "Pagada",
  "Rechazada",
  "Cancelada",
  "Borrador",
];

interface ProveedorOpt { id: string; nombre: string }
interface CategoriaOpt { id: string; nombre: string }

interface Props {
  includePrimary: boolean;
  estatus: EstatusCxP | "todos";
  onEstatusChange: (v: EstatusCxP | "todos") => void;
  moneda: "todas" | Moneda;
  onMonedaChange: (v: "todas" | Moneda) => void;
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
  proveedoresOpts: ProveedorOpt[];
  categoriasOpts: CategoriaOpt[];
}

export function CxpFiltrosSheetFields(props: Props) {
  return (
    <div className="space-y-4">
      {props.includePrimary && (
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
            <Select value={props.moneda} onValueChange={(v) => props.onMonedaChange(v as Props["moneda"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* v13.307.16 — Aprobación integrada en el chip primario;
              el filtro `?aprobacion=` sigue disponible vía deep-link. */}
        </>
      )}
      <div className="space-y-1">
        <Label>Proveedor</Label>
        <Select value={props.proveedorId || "todos"} onValueChange={props.onProveedorChange}>
          <SelectTrigger><SelectValue placeholder="Todos los proveedores" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="todos">Todos los proveedores</SelectItem>
            {props.proveedoresOpts.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Categoría de presupuesto</Label>
        <Select
          value={props.categoriaPresupuestoId || "todas"}
          onValueChange={props.onCategoriaPresupuestoChange}
        >
          <SelectTrigger><SelectValue placeholder="Todas las categorías" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {props.categoriasOpts.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>{rangoLabel("Emisión", "desde")}</Label>
          <DatePickerMx
            value={props.fechaDesde}
            onChange={props.onFechaDesdeChange}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <Label>{rangoLabel("Emisión", "hasta")}</Label>
          <DatePickerMx
            value={props.fechaHasta}
            onChange={props.onFechaHastaChange}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
