import { Toaster as SonnerToaster } from "sonner";

/**
 * Toaster global de la app (Sonner).
 *
 * v13.301.61 — **Colores unificados**. Se retiró `richColors` para que TODOS
 * los toasts compartan la misma superficie (`bg-card`) y la severidad se
 * comunique sólo por:
 *  - icono a color (Sonner lo pinta automáticamente por `data-type`),
 *  - un borde izquierdo de 4 px con el token semántico (`destructive`,
 *    `success`, `warning`, `info` / `muted`),
 *  - jerarquía tipográfica del título.
 *
 * Ventajas: elimina el choque visual entre toasts de distinta severidad al
 * encolar avisos (antes: fondos rojo/verde/ámbar/azul/blanco simultáneos),
 * respeta la identidad "Apple-like minimal" del proyecto y mantiene 3
 * canales de accesibilidad para severidad (icono + borde + texto).
 *
 * v13.67.2 — Tap targets ≥44px y swipe-to-dismiss ajustado (se conservan).
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      offset={{ top: "72px", right: "16px" }}
      closeButton
      expand
      duration={4000}
      swipeDirections={["right"]}
      toastOptions={{
        // @ts-expect-error sonner permite estas keys en runtime aunque el d.ts las marca a nivel <Toaster>
        swipeThreshold: 80,
        classNames: {
          toast: [
            "group toast rounded-lg px-4 py-3 gap-3 backdrop-blur-sm shadow-xl",
            "bg-card text-card-foreground border border-border",
            // Borde izquierdo semántico por severidad (Sonner emite data-type).
            "data-[type=error]:border-l-4 data-[type=error]:border-l-destructive",
            "data-[type=success]:border-l-4 data-[type=success]:border-l-[hsl(var(--success))]",
            "data-[type=warning]:border-l-4 data-[type=warning]:border-l-[hsl(var(--warning))]",
            "data-[type=info]:border-l-4 data-[type=info]:border-l-[hsl(var(--info))]",
          ].join(" "),
          title: "text-sm font-semibold leading-tight text-foreground",
          description: "text-xs text-muted-foreground leading-snug mt-0.5",
          // Icono coloreado por severidad (sin fondo tintado).
          icon: [
            "shrink-0",
            "group-data-[type=error]:text-destructive",
            "group-data-[type=success]:text-[hsl(var(--success))]",
            "group-data-[type=warning]:text-[hsl(var(--warning))]",
            "group-data-[type=info]:text-[hsl(var(--info))]",
          ].join(" "),
          actionButton:
            "!min-h-11 !min-w-[44px] !px-3 !py-2 !bg-primary !text-primary-foreground !text-sm !font-medium !rounded-md",
          cancelButton:
            "!min-h-11 !min-w-[44px] !px-3 !py-2 !bg-muted !text-muted-foreground !rounded-md",
          closeButton:
            "!opacity-100 !h-6 !w-6 !left-auto !right-2 !top-2 !bg-card !border !border-border !text-muted-foreground hover:!text-foreground hover:!bg-muted !transition-colors",
        },
      }}
    />
  );
}
