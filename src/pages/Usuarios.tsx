import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";

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
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id, role, id")
      .order("user_id");

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // We can't query auth.users directly, so we show user_id and role
    const rows: UserRow[] = (data ?? []).map((r: any) => ({
      user_id: r.user_id,
      email: r.user_id, // Will be replaced if we can get email
      role: r.role as AppRole,
      created_at: "",
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground">Administra roles y permisos de los usuarios del sistema.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario (ID)</TableHead>
                <TableHead>Rol actual</TableHead>
                <TableHead>Cambiar rol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-mono text-xs">{u.user_id}</TableCell>
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
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
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
