import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nombre: string;
  onNombreChange: (v: string) => void;
  rfc: string;
  onRfcChange: (v: string) => void;
  onCreate: () => void;
  isPending: boolean;
}

export function NuevaOrganizacionDialog({
  open,
  onOpenChange,
  nombre,
  onNombreChange,
  rfc,
  onRfcChange,
  onCreate,
  isPending,
}: Props) {
  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Building2}
      title="Nueva Organización"
      description="Crea una nueva organización en el sistema con su configuración inicial."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onCreate} disabled={!nombre.trim() || isPending}>Crear</Button>
        </>
      }
    >
      <FormDialogSection flat>
        <div className="space-y-1.5">
          <Label>Nombre *</Label>
          <Input
            value={nombre}
            onChange={(e) => onNombreChange(e.target.value)}
            placeholder="Nombre de la empresa"
          />
        </div>
        <div className="space-y-1.5">
          <Label>RFC</Label>
          <Input
            value={rfc}
            onChange={(e) => onRfcChange(e.target.value)}
            placeholder="RFC (opcional)"
          />
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
