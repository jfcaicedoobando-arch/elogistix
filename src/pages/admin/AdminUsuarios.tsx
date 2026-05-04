import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, Trash2, MoreHorizontal, Search, ShieldOff } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import NuevoUsuarioDialog from "@/components/usuario/NuevoUsuarioDialog";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAdminGlobalUsers, type GlobalUserRow } from "@/hooks/admin/useAdminData";
import { useDeleteUser } from "@/hooks/usuario/useUsuarioMutations";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getRoleLabel } from "@/lib/ui/uiMappings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AdminUsuarios() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GlobalUserRow | null>(null);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("todos");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const { toast } = useToast();
  const { data: users = [], isLoading, refetch } = useAdminGlobalUsers();
  const deleteUser = useDeleteUser();

  const orgs = useMemo(
    () => Array.from(new Set(users.map((u) => u.org_nombre))).sort(),
    [users],
  );
  const roles = useMemo(
    () => Array.from(new Set(users.map((u) => u.role))).sort(),
    [users],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (orgFilter !== "todos" && u.org_nombre !== orgFilter) return false;
      if (roleFilter !== "todos" && u.role !== roleFilter) return false;
      if (q && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, search, orgFilter, roleFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    deleteUser.mutate(deleteTarget.user_id, {
      onSuccess: () => {
        notifySuccess(toast, { title: "Usuario eliminado", description: `Se eliminó ${deleteTarget.email} del sistema.` });
        refetch();
        setDeleteTarget(null);
      },
      onError: (err: unknown) => {
        notifyError(toast, { title: "Error", description: getErrorMessage(err)});
        setDeleteTarget(null);
      },
    });
  };

  // Admin ya no es rojo: rojo se reserva para destructivo.
  const roleBadge: Record<string, string> = {
    super_admin: "bg-primary text-primary-foreground",
    admin: "bg-accent text-accent-foreground border border-primary/20",
    operador: "bg-info/15 text-info border border-info/30",
    viewer: "bg-muted text-muted-foreground border border-border",
    cliente: "bg-secondary text-secondary-foreground",
  };

  const initialsFor = (email: string) => email.slice(0, 2).toUpperCase();

  const columns: DataTableColumn<GlobalUserRow>[] = [
    {
      key: "email",
      header: "Usuario",
      width: "min-w-[260px]",
      className: "font-medium",
      sortable: true,
      sortValue: (u) => u.email,
      render: (u) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
            {initialsFor(u.email)}
          </div>
          <span className="truncate" title={u.email}>{u.email}</span>
        </div>
      ),
    },
    { key: "org", header: "Organización", width: "w-[200px]", sortable: true, sortValue: (u) => u.org_nombre, render: (u) => u.org_nombre },
    {
      key: "role",
      header: "Rol",
      width: "w-[120px]",
      render: (u) => (
        <Badge className={roleBadge[u.role] ?? ""} variant="outline">
          {getRoleLabel(u.role)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "w-[60px]",
      align: "right",
      render: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Acciones para ${u.email}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem disabled>
              <ShieldOff className="h-4 w-4 mr-2" /> Cambiar rol
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteTarget(u)}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Eliminar usuario
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users className="h-6 w-6 text-primary" />}
        title="Usuarios Globales"
        description={`${filtered.length} de ${users.length} usuarios en todas las organizaciones.`}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Nuevo Usuario
          </Button>
        }
      />

      <NuevoUsuarioDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={() => refetch()} showOrgSelector />

      <DoubleConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName={deleteTarget?.email ?? "usuario"}
        description={`El usuario ${deleteTarget?.email} será eliminado permanentemente del sistema, incluyendo sus membresías y roles.`}
        finalDescription="Esta acción eliminará la cuenta de autenticación, roles y membresías de organización. No se puede deshacer."
        onConfirm={handleDelete}
        isPending={deleteUser.isPending}
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por email…"
            className="pl-8"
            aria-label="Buscar usuarios"
          />
        </div>
        <Select value={orgFilter} onValueChange={setOrgFilter}>
          <SelectTrigger className="w-full sm:w-[200px]" aria-label="Filtrar por organización">
            <SelectValue placeholder="Organización" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las organizaciones</SelectItem>
            {orgs.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filtrar por rol">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          emptyMessage="No se encontraron usuarios con los filtros aplicados."
          rowKey={(u) => u.user_id + u.org_nombre}
          density="comfortable"
        />
      </div>
    </div>
  );
}
