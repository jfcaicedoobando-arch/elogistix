import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useNuevaOrganizacionUsuarios } from "@/features/admin/hooks/useNuevaOrganizacionUsuarios";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nombre: string;
  onNombreChange: (v: string) => void;
  rfc: string;
  onRfcChange: (v: string) => void;
  ownerUserId: string;
  onOwnerUserIdChange: (v: string) => void;
  onCreate: () => void;
  isPending: boolean;
}

export function NuevaOrganizacionDialog({
  open, onOpenChange, nombre, onNombreChange, rfc, onRfcChange,
  ownerUserId, onOwnerUserIdChange, onCreate, isPending,
}: Props) {
  const { data: users = [], isLoading } = useNuevaOrganizacionUsuarios(open);

  const [query, setQuery] = useState("");
  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const filtered = users.filter((u) =>
    query.trim() === "" || u.email.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const canSubmit = nombre.trim().length > 0 && ownerUserId.length > 0 && !isPending;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Building2}
      title="Nueva Organización"
      description="Crea una organización y asigna a su administrador inicial en un solo paso."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onCreate} disabled={!canSubmit}>Crear</Button>
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
        <div className="space-y-1.5">
          <Label>Administrador inicial *</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por correo…"
            disabled={isLoading}
          />
          <Select
            value={ownerUserId || undefined}
            onValueChange={onOwnerUserIdChange}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? "Cargando usuarios…" : "Selecciona un usuario"} />
            </SelectTrigger>
            <SelectContent>
              {filtered.slice(0, 50).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
              ))}
              {filtered.length === 0 && !isLoading && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">Sin resultados</div>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Se le asignará el rol <b>admin</b> en la nueva organización.
          </p>
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
