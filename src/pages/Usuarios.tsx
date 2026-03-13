import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, UserPlus } from "lucide-react";
import NuevoUsuarioDialog from "@/components/NuevoUsuarioDialog";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { useUsuarios, useUpdateUserRole, type UserRow } from "@/hooks/useUsuarios";
import type { Enums } from "@/integrations/supabase/types";

type AppRole = Enums<'app_role'>;

const roleBadge: Record<AppRole, string> = {
  admin: "bg-destructive text-destructive-foreground",
  operador: "bg-info text-info-foreground",
  viewer: "bg-muted text-muted-foreground",
};

import { formatDate } from "@/lib/helpers";

export default function Usuarios() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { data: users = [], isLoading, refetch } = useUsuarios();
  const updateRole = useUpdateUserRole();

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    try {
      await updateRole.mutateAsync({ userId, newRole });
      toast({ title: "Rol actualizado" });
    } catch (err: unknown) {
      toast({ title: "Error al cambiar rol", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const columns: DataTableColumn<UserRow>[] = [
    { key: "email", header: "Email", className: "font-medium", render: (u) => u.email },
    { key: "created_at", header: "Fecha de registro", className: "text-xs text-muted-foreground", render: (u) => formatDate(u.created_at) },
    { key: "role", header: "Rol actual", render: (u) => <Badge className={roleBadge[u.role]}>{u.role}</Badge> },
    {
      key: "change_role", header: "Cambiar rol", render: (u) => (
        <Select value={u.role} onValueChange={(val) => handleRoleChange(u.user_id, val as AppRole)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="operador">Operador</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
            <p className="text-sm text-muted-foreground">Administra roles y permisos de los usuarios del sistema.</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      <NuevoUsuarioDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={() => refetch()} />

      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={users}
          isLoading={isLoading}
          emptyMessage="No hay usuarios registrados."
          rowKey={(u) => u.user_id}
        />
      </div>
    </div>
  );
}
