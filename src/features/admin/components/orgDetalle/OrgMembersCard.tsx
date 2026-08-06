import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
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
import { COL_W } from "@/components/shared/dataTable/columnWidths";

interface OrgMembersCardProps {
  members: MemberRow[];
  loading: boolean;
  onAddClick: () => void;
  onChangeRole: (memberId: string, role: AppRole) => void;
  onRemove: (memberId: string) => void;
}

/**
 * v13.232.0 · Confirmación de eliminación migrada a `ConfirmActionDialog`
 * a nivel Card (un único diálogo compartido). Se guarda la fila objetivo
 * en estado local, en lugar de un AlertDialog por fila (Lote 7d.2).
 */
export function OrgMembersCard({ members, loading, onAddClick, onChangeRole, onRemove }: OrgMembersCardProps) {
  const [memberAEliminar, setMemberAEliminar] = useState<MemberRow | null>(null);

  const columns: ColumnDef<MemberRow, unknown>[] = defineColumns<MemberRow>([
    { id: "email", header: "Usuario", meta: { width: COL_W.texto, className: "font-medium" }, cell: ({ row }) => row.original.email ?? row.original.user_id },
    {
      id: "role",
      header: "Rol",
      meta: { width: COL_W.ruta },
      cell: ({ row }) => {
        const r = row.original.role as AppRole;
        return <Badge className={ROLE_BADGE_CLASSES[r] ?? ""}>{ROLE_LABELS[r] ?? r}</Badge>;
      },
    },
    {
      id: "change_role", header: "Cambiar rol", meta: { width: COL_W.texto },
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
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          aria-label="Eliminar miembro"
          onClick={() => setMemberAEliminar(row.original)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
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
          tableClassName="w-full"
        />
      </CardContent>

      <ConfirmActionDialog
        open={!!memberAEliminar}
        onOpenChange={(o) => { if (!o) setMemberAEliminar(null); }}
        title="¿Eliminar miembro?"
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (memberAEliminar) onRemove(memberAEliminar.id);
          setMemberAEliminar(null);
        }}
        description={
          memberAEliminar
            ? <>Se eliminará a <strong>{memberAEliminar.email}</strong> de esta organización. El usuario seguirá existiendo en el sistema.</>
            : null
        }
      />
    </Card>
  );
}
