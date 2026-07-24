/**
 * Tabla de vista previa (dry-run) de la migración de roles legacy.
 * Extraída de MigrarRolesLegacyCard para respetar el límite de 200 líneas.
 */
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/features/admin/domain/roles/roleCatalog";
import type { AppRole } from "@/types/appRole";
import type { MigrarRolesLegacyDryRun } from "@/features/admin/services/migrarRolesLegacy";

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
      <table className="w-full text-xs">
        <thead className="bg-muted/50 sticky top-0">
          <tr>
            <th className="text-left px-2 py-1 font-medium">Fuente</th>
            <th className="text-left px-2 py-1 font-medium">Usuario</th>
            <th className="text-left px-2 py-1 font-medium">Organización</th>
            <th className="text-left px-2 py-1 font-medium">Rol actual</th>
            <th className="text-left px-2 py-1 font-medium">Rol propuesto</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={`${it.fuente}-${it.id}`} className="border-t">
              <td className="px-2 py-1 text-muted-foreground">{it.fuente}</td>
              <td className="px-2 py-1 font-mono text-2xs">{it.user_id.slice(0, 8)}…</td>
              <td className="px-2 py-1 text-muted-foreground">{it.organizacion ?? "—"}</td>
              <td className="px-2 py-1">
                <Badge variant="outline" className="text-2xs">{it.rol_actual}</Badge>
              </td>
              <td className="px-2 py-1">
                <Badge className="text-2xs">
                  {ROLE_LABELS[it.rol_propuesto as AppRole] ?? it.rol_propuesto}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
