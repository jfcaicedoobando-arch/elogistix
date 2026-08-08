import { memo } from "react";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

function OrgSwitcherBase({ collapsed }: { collapsed?: boolean }) {
  const { organization, organizations, setActiveOrganization, clearActiveOrganization, isSuperAdmin } =
    useOrganization();

  if (!isSuperAdmin || organizations.length === 0) return null;

  const items = (
    <>
      <DropdownMenuItem
        onClick={clearActiveOrganization}
        className={!organization ? "bg-accent font-medium" : ""}
      >
        <ShieldCheck className="h-4 w-4 mr-2" />
        Plataforma · Libre Carga
      </DropdownMenuItem>
      {organizations.map((org) => (
        <DropdownMenuItem
          key={org.id}
          onClick={() => setActiveOrganization(org.id)}
          className={org.id === organization?.id ? "bg-accent font-medium" : ""}
        >
          <Building2 className="h-4 w-4 mr-2" />
          {org.nombre}
        </DropdownMenuItem>
      ))}
    </>
  );

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="w-full" aria-label="Cambiar de organización">
            {organization ? <Building2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          {items}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="w-full text-left px-1 py-0.5 rounded-sm hover:bg-sidebar-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        aria-label="Cambiar de organización"
      >
        <div className="text-2xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
          {organization ? "Organización" : "Contexto"}
        </div>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-sidebar-foreground/90">
          {organization ? (
            <Building2 className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" aria-hidden="true" />
          )}
          <span className="truncate flex-1">{organization?.nombre ?? "Plataforma · Libre Carga"}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {items}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


export const OrgSwitcher = memo(OrgSwitcherBase);
