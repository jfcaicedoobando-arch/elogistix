import { memo } from "react";
import { Building2, LogOut } from "lucide-react";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";

/**
 * Aviso de contexto para el super admin de Libre Carga: el super admin NO
 * pertenece a ninguna organización, así que cuando entra a un tenant (cliente)
 * se muestra este banner persistente con salida rápida.
 */
function TenantContextBannerBase() {
  const { isSuperAdmin, organization, clearActiveOrganization } = useOrganization();

  if (!isSuperAdmin || !organization) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 border-b border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-foreground sm:px-6"
    >
      <Building2 className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
      <span>
        Estás viendo la organización <strong>{organization.nombre}</strong> como administrador de la plataforma.
      </span>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto h-7 gap-1.5 text-xs"
        onClick={clearActiveOrganization}
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        Salir del tenant
      </Button>
    </div>
  );
}

export const TenantContextBanner = memo(TenantContextBannerBase);
