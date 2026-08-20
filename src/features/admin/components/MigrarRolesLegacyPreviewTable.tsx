/**
 * Tabla de vista previa (dry-run) de la migración de roles legacy.
 * Extraída de MigrarRolesLegacyCard para respetar el límite de 200 líneas.
 */
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/features/admin/domain/roles/roleCatalog";
import type { AppRole } from "@/types/appRole";
import type { MigrarRolesLegacyDryRun } from "@/features/admin/services/migrarRolesLegacy";

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
interface Props {
  data: MigrarRolesLegacyDryRun;
}

export function MigrarRolesLegacyPreviewTable({ data }: Props) {
  const items = [
    ...data.organization_members.map((r) => ({ ...r, fuente: "organization_members" as const })),
    ...data.user_roles.map((r) => ({ ...r, fuente: "user_roles" as const })),
  ];
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border max-h-52 overflow-auto">
      <Table className="w-full text-body-sm">
        <TableHeader className="bg-muted/50 sticky top-0">
          <TableRow>
            <DetailTableHead>Fuente</DetailTableHead>
            <DetailTableHead>Usuario</DetailTableHead>
            <DetailTableHead>Organización</DetailTableHead>
            <DetailTableHead>Rol actual</DetailTableHead>
            <DetailTableHead>Rol propuesto</DetailTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => (
            <TableRow key={`${it.fuente}-${it.id}`} className="border-t">
              <TableCell className="text-muted-foreground">{it.fuente}</TableCell>
              <TableCell className="font-mono text-label">{it.user_id.slice(0, 8)}…</TableCell>
              <TableCell className="text-muted-foreground">{it.organizacion ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-label">{it.rol_actual}</Badge>
              </TableCell>
              <TableCell>
                <Badge className="text-label">
                  {ROLE_LABELS[it.rol_propuesto as AppRole] ?? it.rol_propuesto}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
