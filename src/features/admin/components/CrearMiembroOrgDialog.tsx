import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, RefreshCw } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useCreateOrgMember } from "@/features/admin/hooks";
import { generarPassword, evaluarFuerza } from "@/lib/passwords/generator";
import type { AppRole } from "@/types/appRole";
import { ASSIGNABLE_ROLES_ADMIN_ORG, ROLE_LABELS } from "@/features/admin/domain/roles/roleCatalog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onCreated: () => void;
}

/**
 * Crea un usuario NUEVO directamente dentro de la organización dada.
 * Regla de negocio: un usuario sólo puede pertenecer a una organización,
 * por eso no permitimos "mover" usuarios existentes — siempre se crea uno nuevo.
 */
export default function CrearMiembroOrgDialog({ open, onOpenChange, organizationId, onCreated }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generarPassword(12));
  const [role, setRole] = useState<AppRole>("coordinador_logistico");

  const createMember = useCreateOrgMember();
  const loading = createMember.isPending;
  const fuerza = evaluarFuerza(password);

  const reset = () => {
    setEmail("");
    setPassword(generarPassword(12));
    setRole("coordinador_logistico");
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!email || !password) return;
    try {
      await createMember.mutateAsync({ organizationId, email, password, role });
      handleClose(false);
      onCreated();
    } catch {
      // toast lo gestiona el hook
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleClose}
      icon={UserPlus}
      title="Crear miembro"
      description="Da de alta un usuario nuevo en esta organización. Recuerda: un usuario sólo puede pertenecer a una organización."
      size="md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !email || !password}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Crear miembro
          </Button>
        </>
      }
    >
      <FormDialogSection flat>
        <div className="space-y-1.5">
          <Label htmlFor="crear-miembro-email">Email</Label>
          <Input
            id="crear-miembro-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@empresa.com"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="crear-miembro-password">Contraseña temporal</Label>
          <div className="flex gap-2">
            <Input
              id="crear-miembro-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setPassword(generarPassword(12))}
              aria-label="Generar nueva contraseña"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {fuerza.label && (
            <p className="text-xs text-muted-foreground">Fuerza: {fuerza.label}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Rol en la organización</Label>
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES_ADMIN_ORG.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
