/**
 * Diálogo para crear/editar categoría presupuestal.
 */
import { useEffect, useState } from "react";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import {
  useCrearCategoriaPresupuesto, useActualizarCategoriaPresupuesto,
} from "@/features/presupuesto/hooks";
import type { CategoriaPresupuesto } from "@/features/presupuesto/services";
import type { Enums } from "@/integrations/supabase/types";

import { notifyError } from "@/lib/ui/appFeedback";

type TipoContable = Enums<"tipo_contable_categoria">;

const TIPO_CONTABLE_OPCIONES: { value: TipoContable; label: string; descripcion: string }[] = [
  { value: "CostoDirectoEmbarque", label: "Costos directos de embarque (COGS)", descripcion: "COGS: flete, maniobras, demoras, comisiones. Va directo al costo del embarque, no cuenta como gasto fijo." },
  { value: "Administracion", label: "Gastos de administración", descripcion: "Renta, nómina admin, contador, papelería. Cuenta como gasto fijo." },
  { value: "Venta", label: "Gastos de venta", descripcion: "Comisiones de vendedor, marketing, viáticos comerciales. Cuenta como gasto fijo." },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoria?: CategoriaPresupuesto | null;
}

export function DialogCategoria({ open, onOpenChange, categoria }: Props) {
  const crear = useCrearCategoriaPresupuesto();
  const actualizar = useActualizarCategoriaPresupuesto();
  const [nombre, setNombre] = useState("");
  const [orden, setOrden] = useState(50);
  const [activa, setActiva] = useState(true);
  const [tipoContable, setTipoContable] = useState<TipoContable>("Administracion");

  useEffect(() => {
    if (categoria) {
      setNombre(categoria.nombre);
      setOrden(categoria.orden);
      setActiva(categoria.activa);
      setTipoContable(categoria.tipo_contable ?? "Administracion");
    } else {
      setNombre(""); setOrden(50); setActiva(true); setTipoContable("Administracion");
    }
  }, [categoria, open]);

  const submit = async () => {
    if (!nombre.trim()) return notifyError(undefined, { title: "Nombre requerido", method: "FEATURES_PRESUPUESTO_COMPONENTS_DIALOGCATEGORIA_1" });
    try {
      if (categoria) {
        await actualizar.mutateAsync({ id: categoria.id, patch: { nombre: nombre.trim(), orden, activa, tipo_contable: tipoContable } });
        notifySuccess(undefined, { title: "Categoría actualizada" });
      } else {
        await crear.mutateAsync({ nombre: nombre.trim(), orden, activa, tipo_contable: tipoContable });
        notifySuccess(undefined, { title: "Categoría creada" });
      }
      onOpenChange(false);
    } catch (e) {
      const err = e as { message?: string };
      notifyError(undefined, { title: err.message ?? "Error al guardar", error: e, method: "FEATURES_PRESUPUESTO_COMPONENTS_DIALOGCATEGORIA_2" });
    }
  };

  const tipoActual = TIPO_CONTABLE_OPCIONES.find((o) => o.value === tipoContable);

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FolderTree}
      title={`${categoria ? "Editar" : "Nueva"} categoría`}
      description="Categorías de gasto para el presupuesto y el cálculo de cobertura de gastos fijos del dashboard."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={crear.isPending || actualizar.isPending}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Nombre *</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Servicios profesionales" />
        </div>
        <div>
          <Label>Tipo contable *</Label>
          <Select value={tipoContable} onValueChange={(v) => setTipoContable(v as TipoContable)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPO_CONTABLE_OPCIONES.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tipoActual && <p className="text-label text-muted-foreground mt-1">{tipoActual.descripcion}</p>}
        </div>
        <div>
          <Label>Orden</Label>
          <Input type="number" value={orden} onChange={(e) => setOrden(Number(e.target.value))} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={activa} onCheckedChange={(v) => setActiva(!!v)} /> Activa
        </label>
      </div>
    </FormDialogShell>
  );
}
