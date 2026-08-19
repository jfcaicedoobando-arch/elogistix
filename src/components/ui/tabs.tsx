import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

export type TabsVariant = "default" | "underline";

/** Clases oficiales del estilo "underline" (V-12). Se exportan para que
 *  navegaciones que no usan Radix Tabs (p.ej. nav de rutas con `NavLink`)
 *  puedan compartir el mismo token visual sin duplicar la definición. */
export const tabsUnderlineListClass =
  "bg-transparent border-0 border-b border-border rounded-none p-0 h-auto gap-4 justify-start";

export const tabsUnderlineTriggerClass =
  "rounded-none border-b-2 border-transparent bg-transparent px-1 pb-2 pt-0 text-body font-medium text-muted-foreground shadow-none transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none hover:text-foreground -mb-px";

const tabsListVariants: Record<TabsVariant, string> = {
  default: "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
  underline: tabsUnderlineListClass,
};

const tabsTriggerVariants: Record<TabsVariant, string> = {
  default:
    "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  underline: tabsUnderlineTriggerClass,
};

const TabsList = ({
  ref,
  className,
  variant = "default",
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.List>>;
  /** `default` = pastilla con fondo (comportamiento histórico).
   *  `underline` (V-12) = línea inferior, para cockpits densos. */
  variant?: TabsVariant;
}) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants[variant], className)}
    {...props}
  />
);
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = ({
  ref,
  className,
  variant = "default",
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
  ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Trigger>>;
  variant?: TabsVariant;
}) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      tabsTriggerVariants[variant],
      className,
    )}
    {...props}
  />
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> & { ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Content>> }) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
);
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
