import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Tables, TablesUpdate } from "@/types/db";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useEditarProveedorController } from "@/features/proveedor/hooks";
import EditarProveedorGastoFiscalFields from "./EditarProveedorGastoFiscalFields";
import EditarProveedorBancariosFields from "./EditarProveedorBancariosFields";
import EditarProveedorIdentidadFields from "./EditarProveedorIdentidadFields";
import EditarProveedorContactoFields from "./EditarProveedorContactoFields";

type Proveedor = Tables<"proveedores">;

interface Props {
  proveedor: Proveedor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    id: string,
    data: TablesUpdate<"proveedores">,
    expectedUpdatedAt?: string | null,
    organizationId?: string | null,
  ) => Promise<unknown>;
}

export default function EditarProveedorDialog({ proveedor, open, onOpenChange, onSave }: Props) {
  const c = useEditarProveedorController(proveedor, open, onSave, () => onOpenChange(false));

  const origen = c.form.origen_proveedor;
  const headerAside = origen ? (
    <Badge variant={origen === "Nacional" ? "secondary" : "outline"} className="text-label font-medium">
      {origen}
    </Badge>
  ) : undefined;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Building2}
      title="Editar proveedor"
      description="Modifica la información fiscal y de contacto del proveedor."
      size="xl"
      headerAside={headerAside}
      footer={(
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={c.handleSave} disabled={!c.isValid || c.isSaving}>
            {c.isSaving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <EditarProveedorIdentidadFields c={c} />

        {c.isGasto && <EditarProveedorGastoFiscalFields c={c} />}

        <EditarProveedorContactoFields c={c} />

        <EditarProveedorBancariosFields c={c} />
      </div>
    </FormDialogShell>
  );
}
