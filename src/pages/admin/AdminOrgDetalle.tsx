import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;

interface MemberRow {
  id: string;
  user_id: string;
  role: AppRole;
  email?: string;
}

export default function AdminOrgDetalle() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: org } = useQuery({
    queryKey: ["admin-org", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["admin-org-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, user_id, role")
        .eq("organization_id", id!)
        .order("created_at");
      if (error) throw error;

      // Try to get emails via edge function
      let emailMap: Record<string, string> = {};
      try {
        const { data: usersData } = await supabase.functions.invoke("list-users");
        if (Array.isArray(usersData)) {
          usersData.forEach((u: { id: string; email: string }) => {
            emailMap[u.id] = u.email;
          });
        }
      } catch { /* */ }

      return (data ?? []).map((m) => ({
        ...m,
        email: emailMap[m.user_id] || m.user_id,
      })) as MemberRow[];
    },
    enabled: !!id,
  });

  const updateRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("organization_members")
        .update({ role })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-org-members", id] });
      toast({ title: "Rol actualizado" });
    },
  });

  const roleBadge: Record<string, string> = {
    super_admin: "bg-primary text-primary-foreground",
    admin: "bg-destructive text-destructive-foreground",
    operador: "bg-info text-info-foreground",
    viewer: "bg-muted text-muted-foreground",
  };

  const columns: DataTableColumn<MemberRow>[] = [
    { key: "email", header: "Usuario", width: "min-w-[200px]", className: "font-medium", render: (m) => m.email ?? m.user_id },
    { key: "role", header: "Rol", width: "w-[100px]", render: (m) => <Badge className={roleBadge[m.role] ?? ""}>{m.role}</Badge> },
    {
      key: "change_role",
      header: "Cambiar rol",
      width: "w-[160px]",
      render: (m) => (
        <Select value={m.role} onValueChange={(val) => updateRole.mutate({ memberId: m.id, role: val as AppRole })}>
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

  if (!org) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{org.nombre}</h1>
          <p className="text-sm text-muted-foreground">RFC: {org.rfc || "—"} · Plan: {org.plan}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Miembros de la organización
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={members}
            isLoading={loadingMembers}
            emptyMessage="Sin miembros."
            rowKey={(m) => m.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
