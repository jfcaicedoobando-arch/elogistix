import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

export type TabsVariant = "default" | "underline" | "seccion" | "vista";

/** Clases oficiales del estilo "underline" (V-12). Se exportan para que
 *  navegaciones que no usan Radix Tabs (p.ej. nav de rutas con `NavLink`)
 *  puedan compartir el mismo token visual sin duplicar la definición. */
export const tabsUnderlineListClass =
  "bg-transparent border-0 border-b border-border rounded-none p-0 h-auto gap-4 justify-start";

export const tabsUnderlineTriggerClass =
  "rounded-none border-b-2 border-transparent bg-transparent px-1 pb-2 pt-0 text-body font-medium text-muted-foreground shadow-none transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none hover:text-foreground -mb-px";

/**
 * (E-8) Dos variantes documentadas para unificar los tres patrones de tabs
 * detectados en la auditoría visual:
 * - `seccion`: pill con fondo, para navegación de secciones completas
 *   (p.ej. /configuracion). Es una variante explícita del look histórico.
 * - `vista`: pill compacto, para alternar la misma información entre dos
 *   vistas (p.ej. Kanban / Tabla).
 * `default` se conserva sin cambios para no romper pantallas existentes.
 */
const tabsListVariants = cva("", {
  variants: {
    variant: {
      default: "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      underline: tabsUnderlineListClass,
      seccion: "inline-flex h-auto flex-wrap items-center justify-start gap-1 rounded-md bg-muted p-1 text-muted-foreground",
      vista: "inline-flex h-9 items-center justify-center gap-0.5 rounded-md bg-muted p-0.5 text-muted-foreground",
    } satisfies Record<TabsVariant, string>,
  },
  defaultVariants: { variant: "default" },
});

const tabsTriggerVariants = cva(
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-body font-medium text-muted-foreground ring-offset-background transition-all hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border",
        underline: tabsUnderlineTriggerClass,
        seccion:
          "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-body font-medium text-muted-foreground ring-offset-background transition-all hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border",
        vista:
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-label font-medium text-muted-foreground ring-offset-background transition-all hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      } satisfies Record<TabsVariant, string>,
    },
    defaultVariants: { variant: "default" },
  },
);

const TabsList = ({
  ref,
  className,
  variant,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants> & {
    ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.List>>;
  }) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
);
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = ({
  ref,
  className,
  variant,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> &
  VariantProps<typeof tabsTriggerVariants> & {
    ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Trigger>>;
  }) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
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
