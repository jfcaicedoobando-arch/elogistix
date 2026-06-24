import { memo } from "react";
import { Building2 } from "lucide-react";
import { useOrganization } from "@/lib/contexts/OrganizationContext";

/**
 * Badge read-only que muestra el nombre de la organización activa en el
 * sidebar. Se renderiza para cualquier usuario autenticado con organización
 * cuando el `OrgSwitcher` no aplica (es decir, no es super admin con varias
 * orgs). Así un admin de tenant siempre sabe en qué cuenta está trabajando.
 */
function OrgBadgeBase({ collapsed }: { collapsed?: boolean }) {
  const { organization, isSuperAdmin, organizations } = useOrganization();

  // Si el OrgSwitcher se va a mostrar (super admin con >1 orgs), no
  // duplicamos información.
  if (isSuperAdmin && organizations.length > 1) return null;
  if (!organization) return null;

  if (collapsed) {
    return (
      <div
        className="flex items-center justify-center h-8 w-full text-sidebar-foreground/70"
        title={organization.nombre}
        aria-label={`Organización: ${organization.nombre}`}
      >
        <Building2 className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 w-full h-8 px-2 rounded-md border border-sidebar-border bg-sidebar-accent/30 text-xs text-sidebar-foreground/80"
      aria-label={`Organización: ${organization.nombre}`}
    >
      <Building2 className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate font-medium">{organization.nombre}</span>
    </div>
  );
}

export const OrgBadge = memo(OrgBadgeBase);
