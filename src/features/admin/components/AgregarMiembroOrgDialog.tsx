import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useAvailableUsers, useAddOrgMember } from "@/features/admin/hooks";
import type { AppRole } from "@/types/appRole";
import { ASSIGNABLE_ROLES_ADMIN_ORG, ROLE_LABELS } from "@/features/admin/domain/roles/roleCatalog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  existingUserIds: string[];
  onAdded: () => void;
}

export default function AgregarMiembroOrgDialog({ open, onOpenChange, organizationId, existingUserIds, onAdded }: Props) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState<AppRole>("coordinador_logistico");

  const { data: allUsers = [], isLoading: loadingUsers } = useAvailableUsers(open);
  const addMember = useAddOrgMember();
  const loading = addMember.isPending;

  const users = useMemo(
    () => allUsers.filter((u) => !existingUserIds.includes(u.id)),
    [allUsers, existingUserIds],
  );

  // 13.85.10 — Los toasts viven en `useAddOrgMember`.
  const handleSubmit = async () => {
    if (!selectedUserId) return;
    try {
      await addMember.mutateAsync({ organizationId, userId: selectedUserId, role });
      onOpenChange(false);
      onAdded();
    } catch {
      // notificación gestionada por hook
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={UserPlus}
      title="Agregar miembro"
      description="Selecciona un usuario existente para agregarlo a esta organización."
      size="md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedUserId}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Agregar
          </Button>
        </>
      }
    >
      <FormDialogSection flat>
        <div className="space-y-1.5">
          <Label>Usuario</Label>
          {loadingUsers ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando usuarios…
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No hay usuarios disponibles para agregar.</p>
          ) : (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
