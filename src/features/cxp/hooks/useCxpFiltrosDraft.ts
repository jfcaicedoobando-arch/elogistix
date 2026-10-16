import { useState } from "react";
import type { CxpFiltrosProps } from "../components/CxpFiltros";

/** Estado del panel: ningún setter aplicado participa en la edición. */
export function useCxpFiltrosDraft(props: CxpFiltrosProps) {
  const [open, setOpen] = useState(false);
  const applied = {
    estatus: props.estatus, moneda: props.moneda, origen: props.origen, aprobacion: props.aprobacion,
    proveedorId: props.proveedorId, categoriaPresupuestoId: props.categoriaPresupuestoId,
    fechaDesde: props.fechaDesde, fechaHasta: props.fechaHasta,
  };
  const [values, setValues] = useState(applied);
  const update = <K extends keyof typeof values>(key: K, value: typeof values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const onOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setValues(applied);
    setOpen(nextOpen);
  };
  const apply = () => {
    if (values.estatus !== props.estatus) props.onEstatusChange(values.estatus);
    if (values.moneda !== props.moneda) props.onMonedaChange(values.moneda);
    if (values.origen !== props.origen) props.onOrigenChange(values.origen);
    if (values.aprobacion !== props.aprobacion) props.onAprobacionChange(values.aprobacion);
    if (values.proveedorId !== props.proveedorId) props.onProveedorChange(values.proveedorId);
    if (values.categoriaPresupuestoId !== props.categoriaPresupuestoId) props.onCategoriaPresupuestoChange(values.categoriaPresupuestoId);
    if (values.fechaDesde !== props.fechaDesde) props.onFechaDesdeChange(values.fechaDesde);
    if (values.fechaHasta !== props.fechaHasta) props.onFechaHastaChange(values.fechaHasta);
    setOpen(false);
  };
  const clear = () => setValues({
    estatus: "todos", moneda: "todas", origen: "todos", aprobacion: "todos",
    proveedorId: "todos", categoriaPresupuestoId: "todas", fechaDesde: "", fechaHasta: "",
  });
  const active = values.estatus !== "todos" || values.moneda !== "todas" ||
    values.origen !== "todos" || values.aprobacion !== "todos" ||
    Boolean(values.proveedorId && values.proveedorId !== "todos") ||
    Boolean(values.categoriaPresupuestoId && values.categoriaPresupuestoId !== "todas") ||
    Boolean(values.fechaDesde || values.fechaHasta);

  return { open, values, update, onOpenChange, apply, clear, active };
}
