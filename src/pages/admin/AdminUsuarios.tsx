import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserPlus } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { queryKeys } from "@/lib/queryKeys";
import NuevoUsuarioAdminDialog from "@/components/admin/NuevoUsuarioAdminDialog";

interface GlobalUserRow {
  user_id: string;
  email: string;
  org_nombre: string;
  role: string;
}

export default function AdminUsuarios() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.admin.allUsers,
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from("organization_members")
        .select("user_id, role, organization_id")
        .order("user_id");
      if (error) throw error;

      const { data: orgs } = await supabase.from("organizations").select("id, nombre");
      const orgMap: Record<string, string> = {};
      (orgs ?? []).forEach((o) => { orgMap[o.id] = o.nombre; });

      let emailMap: Record<string, string> = {};
      try {
        const { data: usersData } = await supabase.functions.invoke("list-users");
        if (Array.isArray(usersData)) {
          usersData.forEach((u: { id: string; email: string }) => { emailMap[u.id] = u.email; });
        }
      } catch { /* */ }

      return (members ?? []).map((m) => ({
        user_id: m.user_id,
        email: emailMap[m.user_id] || m.user_id,
        org_nombre: orgMap[m.organization_id] || m.organization_id,
        role: m.role,
      })) as GlobalUserRow[];
    },
  });

  const roleBadge: Record<string, string> = {
    super_admin: "bg-primary text-primary-foreground",
    admin: "bg-destructive text-destructive-foreground",
    operador: "bg-info text-info-foreground",
    viewer: "bg-muted text-muted-foreground",
  };

  const columns: DataTableColumn<GlobalUserRow>[] = [
    { key: "email", header: "Email", width: "min-w-[200px]", className: "font-medium", sortable: true, sortValue: (u) => u.email, render: (u) => u.email },
    { key: "org", header: "Organización", width: "w-[180px]", sortable: true, sortValue: (u) => u.org_nombre, render: (u) => u.org_nombre },
    { key: "role", header: "Rol", width: "w-[120px]", render: (u) => <Badge className={roleBadge[u.role] ?? ""}>{u.role}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios Globales</h1>
          <p className="text-sm text-muted-foreground">Todos los usuarios de todas las organizaciones.</p>
        </div>
      </div>

      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={users}
          isLoading={isLoading}
          emptyMessage="No hay usuarios."
          rowKey={(u) => u.user_id + u.org_nombre}
        />
      </div>
    </div>
  );
}
