import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { useAvailableUsers, useAddOrgMember } from "@/hooks/admin/useOrgMembersMutations";
import type { AppRole } from "@/types/appRole";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  existingUserIds: string[];
  onAdded: () => void;
}

export default function AgregarMiembroOrgDialog({ open, onOpenChange, organizationId, existingUserIds, onAdded }: Props) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const { toast } = useToast();

  const { data: allUsers = [], isLoading: loadingUsers } = useAvailableUsers(open);
  const addMember = useAddOrgMember();
  const loading = addMember.isPending;

  const users = useMemo(
    () => allUsers.filter((u) => !existingUserIds.includes(u.id)),
    [allUsers, existingUserIds],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    try {
      await addMember.mutateAsync({ organizationId, userId: selectedUserId, role });
      const user = users.find((u) => u.id === selectedUserId);
      notifySuccess(toast, { title: "Miembro agregado", description: `${user?.email ?? "Usuario"} agregado como ${role}` });
      onOpenChange(false);
      onAdded();
    } catch (err: unknown) {
      notifyError(toast, { title: "Error", description: getErrorMessage(err)});
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar miembro</DialogTitle>
          <DialogDescription>Selecciona un usuario existente para agregarlo a esta organización.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label>Rol en la organización</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="operador">Operador</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading || !selectedUserId}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Agregar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
