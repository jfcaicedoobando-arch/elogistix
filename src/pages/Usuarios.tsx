import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import NuevoUsuarioDialog from "@/components/NuevoUsuarioDialog";

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

export default function Usuarios() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);

    // Fetch roles
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .order("user_id");

    if (rolesError) {
      toast({ title: "Error", description: rolesError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch emails from edge function
    let emailMap: Record<string, { email: string; created_at: string }> = {};
    try {
      const { data: usersData, error: fnError } = await supabase.functions.invoke("list-users");
      if (!fnError && Array.isArray(usersData)) {
        usersData.forEach((u: any) => {
          emailMap[u.id] = { email: u.email, created_at: u.created_at };
        });
      }
    } catch {
      // If edge function fails, we'll show user_id instead
    }

    const rows: UserRow[] = (rolesData ?? []).map((r: any) => ({
      user_id: r.user_id,
      email: emailMap[r.user_id]?.email || r.user_id,
      role: r.role as AppRole,
      created_at: emailMap[r.user_id]?.created_at || "",
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  };

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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Fecha de registro</TableHead>
                <TableHead>Rol actual</TableHead>
                <TableHead>Cambiar rol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                  <TableCell>
                    <Badge className={roleBadge[u.role]}>{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(val) => handleRoleChange(u.user_id, val as AppRole)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="operador">Operador</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No hay usuarios registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
