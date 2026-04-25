import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Trash2, UserPlus, Users } from "lucide-react";
import type { MemberRow } from "@/hooks/admin/useAdminOrgMembers";
import type { AppRole } from "@/types/types";

const roleBadge: Record<string, string> = {
  super_admin: "bg-primary text-primary-foreground",
  admin: "bg-destructive text-destructive-foreground",
  operador: "bg-info text-info-foreground",
  viewer: "bg-muted text-muted-foreground",
};

interface OrgMembersCardProps {
  members: MemberRow[];
  loading: boolean;
  onAddClick: () => void;
  onChangeRole: (memberId: string, role: AppRole) => void;
  onRemove: (memberId: string) => void;
}

export function OrgMembersCard({ members, loading, onAddClick, onChangeRole, onRemove }: OrgMembersCardProps) {
  const columns: DataTableColumn<MemberRow>[] = [
    { key: "email", header: "Usuario", width: "min-w-[200px]", className: "font-medium", render: (m) => m.email ?? m.user_id },
    { key: "role", header: "Rol", width: "w-[100px]", render: (m) => <Badge className={roleBadge[m.role] ?? ""}>{m.role}</Badge> },
    {
      key: "change_role", header: "Cambiar rol", width: "w-[160px]",
      render: (m) => (
        <Select value={m.role} onValueChange={(val) => onChangeRole(m.id, val as AppRole)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="operador">Operador</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "eliminar", header: "", headerClassName: "w-12",
      render: (m) => (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar miembro?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará a <strong>{m.email}</strong> de esta organización. El usuario seguirá existiendo en el sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => { e.preventDefault(); onRemove(m.id); }}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" /> Miembros ({members.length})
        </CardTitle>
        <Button size="sm" className="gap-1" onClick={onAddClick}>
          <UserPlus className="h-4 w-4" /> Agregar miembro
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={members}
          isLoading={loading}
          emptyMessage="Sin miembros."
          rowKey={(m) => m.id}
        />
      </CardContent>
    </Card>
  );
}
