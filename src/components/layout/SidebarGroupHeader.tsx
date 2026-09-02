import { ChevronRight } from "lucide-react";
import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  hasActive: boolean;
  open: boolean;
}

/**
 * Encabezado colapsable de un grupo del sidebar. Extraído de
 * `SidebarGroupBlock` (Power of 10: archivos ≤200 líneas).
 */
export function SidebarGroupHeader({ label, hasActive, open }: Props) {
  return (
    <CollapsibleTrigger
      aria-label={`Colapsar sección ${label}`}
      aria-expanded={open}
      className={cn(
        "flex w-full items-center justify-between px-3 py-2 text-label font-semibold uppercase tracking-wider transition-colors",
        hasActive
          ? "text-sidebar-primary"
          : "text-sidebar-foreground/80 hover:text-sidebar-foreground",
      )}
    >
      <span>{label}</span>
      <ChevronRight
        className={cn(
          "h-3.5 w-3.5 transition-transform",
          hasActive ? "text-sidebar-primary" : "text-sidebar-foreground/60",
          open && "rotate-90",
        )}
      />
    </CollapsibleTrigger>
  );
}
