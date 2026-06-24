import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { Trash2, UserPlus, Users } from "lucide-react";
import type { MemberRow } from "@/features/admin/hooks";
import type { AppRole } from "@/types/appRole";
import {
  ASSIGNABLE_ROLE_GROUPS,
  LEGACY_ROLES,
  ROLE_BADGE_CLASSES,
  ROLE_LABELS,
} from "@/features/admin/domain/roles/roleCatalog";

interface OrgMembersCardProps {
  members: MemberRow[];
  loading: boolean;
  onAddClick: () => void;
  onChangeRole: (memberId: string, role: AppRole) => void;
  onRemove: (memberId: string) => void;
}

export function OrgMembersCard({ members, loading, onAddClick, onChangeRole, onRemove }: OrgMembersCardProps) {
  const columns: ColumnDef<MemberRow, unknown>[] = defineColumns<MemberRow>([
    { id: "email", header: "Usuario", meta: { width: "min-w-[200px]", className: "font-medium" }, cell: ({ row }) => row.original.email ?? row.original.user_id },
    {
      id: "role",
      header: "Rol",
      meta: { width: "w-[180px]" },
      cell: ({ row }) => {
        const r = row.original.role as AppRole;
        return <Badge className={ROLE_BADGE_CLASSES[r] ?? ""}>{ROLE_LABELS[r] ?? r}</Badge>;
      },
    },
    {
      id: "change_role", header: "Cambiar rol", meta: { width: "w-[220px]" },
      cell: ({ row }) => {
        const m = row.original;
        const currentRole = m.role as AppRole;
        const isLegacy = (LEGACY_ROLES as readonly string[]).includes(currentRole);
        return (
          <Select value={currentRole} onValueChange={(val) => onChangeRole(m.id, val as AppRole)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLE_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.roles.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
              {isLegacy && (
                <SelectGroup>
                  <SelectLabel>Legacy</SelectLabel>
                  <SelectItem value={currentRole} disabled>{ROLE_LABELS[currentRole]}</SelectItem>
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      id: "eliminar", header: "", meta: { headerClassName: "w-12" },
      cell: ({ row }) => {
        const m = row.original;
        return (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Eliminar miembro">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className={dialogSize.sm}>
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
        );
      },
    },
  ]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" /> Miembros ({members.length})
        </CardTitle>
        <Button size="sm" className="gap-1" onClick={onAddClick}>
          <UserPlus className="h-4 w-4" /> Crear miembro
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={members}
          isLoading={loading}
          emptyMessage="Sin miembros."
          rowKey={(m) => m.id}
          density="comfortable"
        />
      </CardContent>
    </Card>
  );
}
