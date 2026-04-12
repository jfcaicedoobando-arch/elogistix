import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errorUtils";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { AppRole } from "@/data/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  existingUserIds: string[];
  onAdded: () => void;
}

interface UserOption {
  id: string;
  email: string;
}

export default function AgregarMiembroOrgDialog({ open, onOpenChange, organizationId, existingUserIds, onAdded }: Props) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: [...queryKeys.admin.allUsers, 'options'],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("list-users");
      return Array.isArray(data) ? (data as UserOption[]) : [];
    },
    enabled: open,
  });

  const users = useMemo(
    () => allUsers.filter((u) => !existingUserIds.includes(u.id)),
    [allUsers, existingUserIds],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("organization_members")
        .insert({ organization_id: organizationId, user_id: selectedUserId, role });

      if (error) throw error;

      const user = users.find((u) => u.id === selectedUserId);
      toast({ title: "Miembro agregado", description: `${user?.email ?? "Usuario"} agregado como ${role}` });
      onOpenChange(false);
      onAdded();
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
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
