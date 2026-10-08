/**
 * Alta provisional de un agente desde Nueva tarifa. Crea el proveedor en estado
 * provisional + el agente ligado; Contabilidad lo aprueba después.
 */
import { UserPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useAgenteProvisionalDialog } from "@/features/costeo/hooks/useAgenteProvisionalDialog";

interface Props { onCreado: (agenteId: string) => void }

export function AgenteProvisionalDialog({ onCreado }: Props) {
  const { open, setOpen, f, setF, crear, puede } = useAgenteProvisionalDialog(onCreado);
  const campo = (k: keyof typeof f, label: string, ph?: string) => (
    <div>
      <Label htmlFor={`ag-prov-${k}`}>{label}</Label>
      <Input id={`ag-prov-${k}`} value={f[k]} placeholder={ph}
        onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <>
      <Button type="button" variant="ghost" size="sm"
        className="mt-1 h-7 px-1 text-label text-muted-foreground" onClick={() => setOpen(true)}>
        <Plus className="mr-1 size-3" /> Agente provisional
      </Button>
      <FormDialogShell
        open={open}
        onOpenChange={setOpen}
        icon={UserPlus}
        title="Agente provisional"
        description="Úsalo para capturar la tarifa ahora. Contabilidad completará sus datos y lo aprobará como proveedor."
        size="sm"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" disabled={!puede} onClick={() => crear.mutate()}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-3">
          {campo("nombre", "Nombre *", "Ej. Shenzhen Logistics Co.")}
          {campo("pais", "País (código)", "CN")}
          {campo("contacto", "Contacto")}
          {campo("email", "Correo")}
        </div>
      </FormDialogShell>
    </>
  );
}
