import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";

/**
 * ToggleGroup minimal — variante "outline" estilo segmented control.
 * Uso intencional: filtro inline (ej. Todas/Pendientes/Facturadas) cuando
 * existe un `Tabs` principal y queremos diferenciarlo visualmente.
 */
const ToggleGroup = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & { ref?: React.Ref<React.ElementRef<typeof ToggleGroupPrimitive.Root>> }) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex items-center rounded-md border border-border bg-background p-0.5",
      className,
    )}
    {...props}
  />
);
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & { ref?: React.Ref<React.ElementRef<typeof ToggleGroupPrimitive.Item>> }) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
      "hover:bg-muted hover:text-foreground",
      "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:shadow-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
);
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
