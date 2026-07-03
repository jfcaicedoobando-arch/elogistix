/**
 * `actionsColumn` — helper para columna de acciones (dropdown) tipada.
 * Extraído de `columnBuilders.tsx` para respetar Power of 10 (<=200 líneas).
 */
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ActionItem<T> {
  label: string;
  icon?: ReactNode;
  onSelect: (row: T) => void;
  disabled?: (row: T) => boolean;
  variant?: "default" | "destructive";
}

export interface ActionsColumnOpts<T> {
  id?: string;
  header?: string;
  items: (row: T) => ActionItem<T>[];
}

export function actionsColumn<T>({
  id = "actions",
  header = "",
  items,
}: ActionsColumnOpts<T>): ColumnDef<T, unknown> {
  return {
    id,
    header,
    cell: ({ row }) => {
      const opts = items(row.original);
      if (!opts.length) return null;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" aria-hidden />
              <span className="sr-only">Acciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {opts.map((it) => (
              <DropdownMenuItem
                key={it.label}
                disabled={it.disabled?.(row.original)}
                className={cn(
                  it.variant === "destructive" && "text-destructive focus:text-destructive",
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  it.onSelect(row.original);
                }}
              >
                {it.icon ? <span className="mr-2 inline-flex">{it.icon}</span> : null}
                {it.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
  };
}
