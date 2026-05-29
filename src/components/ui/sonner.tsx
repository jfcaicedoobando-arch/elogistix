import { Toaster as SonnerToaster } from "sonner";

/**
 * Toaster global de la app (Sonner). Reemplaza al stack shadcn/toast.
 * Theming alineado a los tokens HSL del design system vía classNames.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error:
            "group-[.toaster]:!bg-destructive group-[.toaster]:!text-destructive-foreground group-[.toaster]:!border-destructive",
          success:
            "group-[.toaster]:!bg-success/10 group-[.toaster]:!text-success-foreground group-[.toaster]:!border-success/60",
          warning:
            "group-[.toaster]:!bg-warning/10 group-[.toaster]:!text-warning-foreground group-[.toaster]:!border-warning/60",
          info: "group-[.toaster]:!bg-background group-[.toaster]:!text-foreground",
        },
      }}
    />
  );
}
