import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Trash2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import NuevoUsuarioDialog from "@/components/usuario/NuevoUsuarioDialog";
import DoubleConfirmDeleteDialog from "@/components/DoubleConfirmDeleteDialog";

interface GlobalUserRow {
  user_id: string;
  email: string;
  org_nombre: string;
  role: string;
}

export default function AdminUsuarios() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GlobalUserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await supabase.functions.invoke("delete-user", {
        body: { user_id: deleteTarget.user_id },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (res.error) throw new Error(res.error.message || "Error al eliminar usuario");
      const body = res.data;
      if (body?.error) throw new Error(body.error);

      toast({ title: "Usuario eliminado", description: `Se eliminó ${deleteTarget.email} del sistema.` });
      refetch();
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

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
    {
      key: "actions",
      header: "",
      width: "w-[60px]",
      render: (u) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setDeleteTarget(u)}
          title="Eliminar usuario"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuarios Globales</h1>
            <p className="text-sm text-muted-foreground">Todos los usuarios de todas las organizaciones.</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      <NuevoUsuarioDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={() => refetch()} showOrgSelector />

      <DoubleConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName={deleteTarget?.email ?? "usuario"}
        description={`El usuario ${deleteTarget?.email} será eliminado permanentemente del sistema, incluyendo sus membresías y roles.`}
        finalDescription="Esta acción eliminará la cuenta de autenticación, roles y membresías de organización. No se puede deshacer."
        onConfirm={handleDelete}
        isPending={deleting}
      />

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
