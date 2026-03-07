import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, UserPlus } from "lucide-react";
import NuevoUsuarioDialog from "@/components/NuevoUsuarioDialog";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

type AppRole = "admin" | "operador" | "viewer";

interface UserRow {
  user_id: string;
  email: string;
  role: AppRole;
  created_at: string;
}

const roleBadge: Record<AppRole, string> = {
  admin: "bg-destructive text-destructive-foreground",
  operador: "bg-info text-info-foreground",
  viewer: "bg-muted text-muted-foreground",
};

const formatDateLocal = (dateStr: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

export default function Usuarios() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);

    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .order("user_id");

    if (rolesError) {
      toast({ title: "Error", description: rolesError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    let emailMap: Record<string, { email: string; created_at: string }> = {};
    try {
      const { data: usersData, error: fnError } = await supabase.functions.invoke("list-users");
      if (!fnError && Array.isArray(usersData)) {
        usersData.forEach((usuario: any) => {
          emailMap[usuario.id] = { email: usuario.email, created_at: usuario.created_at };
        });
      }
    } catch {
      // If edge function fails, we'll show user_id instead
    }

    const rows: UserRow[] = (rolesData ?? []).map((rolUsuario: any) => ({
      user_id: rolUsuario.user_id,
      email: emailMap[rolUsuario.user_id]?.email || rolUsuario.user_id,
      role: rolUsuario.role as AppRole,
      created_at: emailMap[rolUsuario.user_id]?.created_at || "",
    }));

    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Error al cambiar rol", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rol actualizado" });
      fetchUsers();
    }
  };

  const columns: DataTableColumn<UserRow>[] = [
    { key: "email", header: "Email", className: "font-medium", render: (u) => u.email },
    { key: "created_at", header: "Fecha de registro", className: "text-xs text-muted-foreground", render: (u) => formatDateLocal(u.created_at) },
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

      <NuevoUsuarioDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchUsers} />

      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={users}
          isLoading={loading}
          emptyMessage="No hay usuarios registrados."
          rowKey={(u) => u.user_id}
        />
      </div>
    </div>
  );
}
