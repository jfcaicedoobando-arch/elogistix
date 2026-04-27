import { useOrganization } from "@/contexts/OrganizationContext";
import { Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function OrgSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { organization, organizations, setActiveOrganization, isSuperAdmin } = useOrganization();

  if (!isSuperAdmin || organizations.length <= 1) return null;

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="w-full" aria-label="Cambiar de organización">
            <Building2 className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => setActiveOrganization(org.id)}
              className={org.id === organization?.id ? "bg-accent font-medium" : ""}
            >
              {org.nombre}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between text-xs h-8 border-sidebar-border bg-sidebar-accent/30"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{organization?.nombre ?? "Sin org"}</span>
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
