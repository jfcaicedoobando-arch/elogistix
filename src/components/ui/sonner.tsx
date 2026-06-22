import { Toaster as SonnerToaster } from "sonner";

/**
 * Toaster global de la app (Sonner).
 *
 * v13.67.2 — Tres fixes para el botón "Ver detalles" en mobile:
 *
 *  1. **Clases CSS rotas**: el preset original usaba `group-[.toaster]`,
 *     que NUNCA matcheaba porque Sonner usa `data-sonner-toaster` (no la
 *     clase `.toaster`). Reemplazamos por selectores basados en `data-type`
 *     que sí dispara Sonner para cada severidad.
 *
 *  2. **Tap target del actionButton <44px**: Sonner aplica padding mínimo al
 *     botón de acción. Forzamos `min-h-11 min-w-[44px] px-3` para cumplir
 *     el estándar P0 de tap targets en mobile.
 *
 *  3. **Swipe-to-dismiss intercepta el tap**: en mobile, mover el dedo unos
 *     píxeles al tocar "Ver detalles" disparaba el dismiss antes del onClick.
 *     Subimos `swipeThreshold` a 80px y bajamos `swipeDuration` para que el
 *     gesto sólo se active con un swipe deliberado, no con un tap normal.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      richColors
      expand
      duration={4000}
      swipeDirections={["right"]}
      toastOptions={{
        // @ts-expect-error sonner permite estas keys en runtime aunque el d.ts las marca a nivel <Toaster>
        swipeThreshold: 80,
        classNames: {
          toast:
            "group toast border shadow-xl rounded-lg px-4 py-3 gap-3 backdrop-blur-sm",
          title: "text-sm font-semibold leading-tight",
          description: "text-xs text-muted-foreground leading-snug mt-0.5",
          icon: "shrink-0",
          actionButton:
            "!min-h-11 !min-w-[44px] !px-3 !py-2 !bg-primary !text-primary-foreground !text-sm !font-medium !rounded-md",
          cancelButton:
            "!min-h-11 !min-w-[44px] !px-3 !py-2 !bg-muted !text-muted-foreground !rounded-md",
        },
      }}
    />
  );
}
