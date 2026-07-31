import * as React from "react";
import { type DialogProps } from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const Command = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive> & { ref?: React.Ref<React.ElementRef<typeof CommandPrimitive>> }) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className,
    )}
    {...props}
  />
);
Command.displayName = CommandPrimitive.displayName;

type CommandDialogProps = DialogProps;

const CommandDialog = ({ children, ...props }: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-2xl top-[12%] translate-y-0 data-[state=open]:top-[12%]">
        <DialogTitle className="sr-only">Búsqueda global</DialogTitle>
        <DialogDescription className="sr-only">Busca embarques, clientes, proveedores y facturas</DialogDescription>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

const CommandInput = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & { ref?: React.Ref<React.ElementRef<typeof CommandPrimitive.Input>> }) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
);

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.List> & { ref?: React.Ref<React.ElementRef<typeof CommandPrimitive.List>> }) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[min(60vh,26rem)] overflow-y-auto overflow-x-hidden scroll-py-2", className)}
    {...props}
  />
);

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = ({ ref, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty> & { ref?: React.Ref<React.ElementRef<typeof CommandPrimitive.Empty>> }) => <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />;

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group> & { ref?: React.Ref<React.ElementRef<typeof CommandPrimitive.Group>> }) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-visible p-1 text-foreground [&_[cmdk-group-heading]]:sticky [&_[cmdk-group-heading]]:top-0 [&_[cmdk-group-heading]]:z-10 [&_[cmdk-group-heading]]:bg-popover [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground",
      className,
    )}
    {...props}
  />
);

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator> & { ref?: React.Ref<React.ElementRef<typeof CommandPrimitive.Separator>> }) => (
  <CommandPrimitive.Separator ref={ref} className={cn("-mx-1 h-px bg-border", className)} {...props} />
);
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item> & { ref?: React.Ref<React.ElementRef<typeof CommandPrimitive.Item>> }) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      // Fila seleccionada: superficie azul MUY diluida + barra de acento a la
      // izquierda. Nunca fondo sólido: el texto secundario (gris apagado) debe
      // seguir siendo legible encima.
      "group relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
      "before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:rounded-full before:bg-transparent before:transition-colors",
      "data-[selected=true]:bg-selection data-[selected=true]:text-selection-foreground data-[selected=true]:before:bg-accent",
      "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      className,
    )}
    {...props}
  />
);

CommandItem.displayName = CommandPrimitive.Item.displayName;

/** Pie del diálogo con las teclas de ayuda (navegar / abrir / cerrar). */
const CommandFooter = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-between gap-3 border-t bg-muted/40 px-3 py-2 text-2xs text-muted-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);
CommandFooter.displayName = "CommandFooter";

/** Tecla individual dentro de `CommandFooter`. */
const CommandKey = ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
  <kbd
    className={cn(
      "pointer-events-none inline-flex h-5 select-none items-center rounded border bg-background px-1.5 font-mono text-2xs font-medium text-muted-foreground",
      className,
    )}
    {...props}
  />
);
CommandKey.displayName = "CommandKey";

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />;
};
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandItem,
  CommandKey,
  CommandShortcut,
  CommandSeparator,
};
