/**
 * Mini-diálogo para crear un proveedor a partir de los datos del CFDI
 * cuando el RFC del emisor no matchea ningún proveedor existente.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProveedorMutations } from "@/features/proveedor/hooks";
import type { TablesInsert } from "@/integrations/supabase/types";

import { notifyError } from "@/components/shared/utils/appFeedback";
interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rfc: string;
  nombre: string;
  organizationId: string | null;
  onCreated: (id: string, nombre: string) => void;
}

export function CrearProveedorDesdeCfdiDialog({
  open, onOpenChange, rfc, nombre, organizationId, onCreated,
}: Props) {
  const [n, setN] = useState(nombre);
  const [r, setR] = useState(rfc);
  const { addProveedor, isAdding } = useProveedorMutations();

  const submit = async () => {
    if (!n.trim() || !r.trim()) {
      notifyError(toast, { title: "Nombre y RFC son obligatorios", method: "FEATURES_CXP_COMPONENTS_CREARPROVEEDORDESDECFDIDIALOG_1" });
      return;
    }
    try {
      const payload: TablesInsert<"proveedores"> = {
        nombre: n.trim(),
        rfc: r.trim().toUpperCase(),
        tipo: "Agente de Carga",
        pais: "México",
        moneda_preferida: "MXN",
        origen_proveedor: "Nacional",
        organization_id: organizationId ?? undefined,
      };
      const created = await addProveedor(payload);
      toast.success("Proveedor creado");
      onCreated(created.id, created.nombre);
      onOpenChange(false);
    } catch (e) {
      const err = e as { name?: string; message?: string; existente?: { id: string; nombre: string } | null };
      if (err.name === "ProveedorDuplicadoError" && err.existente) {
        // Vincular al proveedor existente directamente.
        toast.success(`Vinculado al proveedor existente: ${err.existente.nombre}`);
        onCreated(err.existente.id, err.existente.nombre);
        onOpenChange(false);
        return;
      }
      notifyError(toast, { title: err.message ?? "Error al crear proveedor", method: "FEATURES_CXP_COMPONENTS_CREARPROVEEDORDESDECFDIDIALOG_2" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear proveedor desde CFDI</DialogTitle>
          <DialogDescription>
            El RFC del emisor no existe en tu catálogo. Crea el proveedor para vincular la factura.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Razón social *</Label>
            <Input value={n} onChange={(e) => setN(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>RFC *</Label>
            <Input value={r} onChange={(e) => setR(e.target.value.toUpperCase())} maxLength={13} />
          </div>
          <p className="text-xs text-muted-foreground">
            Tipo: Agente de Carga · País: México · Moneda: MXN (puedes ajustarlo después en Proveedores).
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isAdding}>
            {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear proveedor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
