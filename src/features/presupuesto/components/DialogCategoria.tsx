/**
 * Diálogo para crear/editar categoría presupuestal.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useCrearCategoriaPresupuesto, useActualizarCategoriaPresupuesto,
} from "@/features/presupuesto/hooks";
import type { CategoriaPresupuesto } from "@/features/presupuesto/services";

import { notifyError } from "@/components/shared/utils/appFeedback";
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

  useEffect(() => {
    if (categoria) {
      setNombre(categoria.nombre);
      setOrden(categoria.orden);
      setActiva(categoria.activa);
    } else {
      setNombre(""); setOrden(50); setActiva(true);
    }
  }, [categoria, open]);

  const submit = async () => {
    if (!nombre.trim()) return notifyError(toast, { title: "Nombre requerido", method: "FEATURES_PRESUPUESTO_COMPONENTS_DIALOGCATEGORIA_1" });
    try {
      if (categoria) {
        await actualizar.mutateAsync({ id: categoria.id, patch: { nombre: nombre.trim(), orden, activa } });
        toast.success("Categoría actualizada");
      } else {
        await crear.mutateAsync({ nombre: nombre.trim(), orden, activa });
        toast.success("Categoría creada");
      }
      onOpenChange(false);
    } catch (e) {
      const err = e as { message?: string };
      notifyError(toast, { title: err.message ?? "Error al guardar", error: e, method: "FEATURES_PRESUPUESTO_COMPONENTS_DIALOGCATEGORIA_2" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{categoria ? "Editar" : "Nueva"} categoría</DialogTitle>
          <DialogDescription>Categorías de gasto operativo para el presupuesto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Servicios profesionales" />
          </div>
          <div>
            <Label>Orden</Label>
            <Input type="number" value={orden} onChange={(e) => setOrden(Number(e.target.value))} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={activa} onCheckedChange={(v) => setActiva(!!v)} /> Activa
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={crear.isPending || actualizar.isPending}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
