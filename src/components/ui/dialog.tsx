import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & { ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Overlay>> }) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const isEventInsideSonnerToaster = (event: { target: EventTarget | null }): boolean => {
  const target = event.target as Element | null;
  return !!target?.closest?.("[data-sonner-toaster]");
};

const DialogContent = ({ ref, className, overlayClassName, children, onPointerDownOutside, onInteractOutside, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Content>>;
  /** VT-02: permite elevar el overlay junto con el contenido (p. ej. por encima del viewport de toasts en `z-[60]`). */
  overlayClassName?: string;
}) => (
  <DialogPortal>
    <DialogOverlay className={overlayClassName} />

    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-[calc(100vw-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-overlay rounded-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        className,
      )}
      onPointerDownOutside={(event) => {
        if (isEventInsideSonnerToaster(event.detail.originalEvent)) event.preventDefault();
        onPointerDownOutside?.(event);
      }}
      onInteractOutside={(event) => {
        if (isEventInsideSonnerToaster(event.detail.originalEvent)) event.preventDefault();
        onInteractOutside?.(event);
      }}
      {...props}

    >
      {children}
      {/* v13.823.25: área táctil de 44x44 (mínimo recomendado en móvil); el
          icono sigue midiendo 16px para no cambiar el peso visual. */}
      <DialogPrimitive.Close className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none sm:right-3 sm:top-3">
        <X className="h-4 w-4" />
        <span className="sr-only">Cerrar</span>
      </DialogPrimitive.Close>

    </DialogPrimitive.Content>
  </DialogPortal>
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ ref, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
      {...props}
    />
  );
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ ref, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) => (
    <div
      ref={ref}
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
      {...props}
    />
  );
DialogFooter.displayName = "DialogFooter";

const DialogTitle = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & { ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Title>> }) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-section leading-tight", className)}
    {...props}
  />
);
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> & { ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Description>> }) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-body text-muted-foreground", className)} {...props} />
);
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
