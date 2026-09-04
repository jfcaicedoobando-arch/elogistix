import { memo } from "react";
import { Building2 } from "lucide-react";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { Hint } from "@/components/shared/Hint";

/**
 * Etiqueta de contexto read-only que muestra la organización activa en el
 * sidebar. Se renderiza como caption + nombre (no como botón) para que no se
 * confunda con un módulo navegable. Se oculta cuando el `OrgSwitcher` aplica
 * (super admin con varias orgs) para no duplicar información.
 */
function OrgBadgeBase({ collapsed }: { collapsed?: boolean }) {
  const { organization, isSuperAdmin, organizations } = useOrganization();

  if (isSuperAdmin && organizations.length > 0) return null;
  if (!organization) return null;

  if (collapsed) {
    // VB-49: en el rail colapsado se distingue de los accesos navegables:
    // más compacto, sin hover ni cursor de clic (es una etiqueta, no un botón).
    return (
      <Hint label={`Organización: ${organization.nombre}`}>
        <div
          className="flex items-center justify-center h-6 w-full cursor-default select-none text-sidebar-foreground/50"
          aria-label={`Organización: ${organization.nombre}`}
        >
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
      </Hint>
    );
  }


  return (
    <div
      className="px-1 select-none"
      aria-label={`Organización activa: ${organization.nombre}`}
    >
      <div className="text-2xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
        Organización
      </div>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-sidebar-foreground/90">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" aria-hidden="true" />
        <span className="truncate">{organization.nombre}</span>
      </div>
    </div>
  );
}

export const OrgBadge = memo(OrgBadgeBase);
