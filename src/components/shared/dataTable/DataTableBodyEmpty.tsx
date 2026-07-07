/**
 * Empty state del cuerpo de DataTable. Extraído de `DataTableBody.tsx`
 * para respetar el límite Power of 10 (≤200 líneas por archivo).
 *
 * El slot `emptyState` sólo se usa cuando el caller quiere un `<EmptyState>`
 * grande con CTA. El default renderiza `EmptyStateInline` — misma fuente
 * visual que cards/paneles → toda la app se ve idéntica.
 */
import type React from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { isLucideIcon } from "./isLucideIcon";

interface Props {
  colSpan: number;
  emptyMessage: string;
  emptyHint?: string;
  emptyIcon?: React.ReactNode | LucideIcon;
  emptyState?: React.ReactNode;
}

export function DataTableBodyEmpty({
  colSpan, emptyMessage, emptyHint, emptyIcon, emptyState,
}: Props) {
  const iconComponent = isLucideIcon(emptyIcon) ? emptyIcon : undefined;
  const iconNode = !isLucideIcon(emptyIcon) ? emptyIcon : undefined;
  return (
    <TableBody>
      <TableRow className="hover:bg-transparent even:bg-transparent">
        <TableCell colSpan={colSpan} className="p-0">
          {emptyState ?? (
            iconNode ? (
              <div className="flex flex-col items-center justify-center gap-2 text-center py-10 px-4 text-muted-foreground">
                {iconNode}
                <p className="text-sm">{emptyMessage}</p>
                {emptyHint && <p className="text-xs opacity-75 max-w-xs">{emptyHint}</p>}
              </div>
            ) : (
              <EmptyStateInline
                icon={iconComponent ?? Inbox}
                message={emptyMessage}
                hint={emptyHint}
                className="py-10"
              />
            )
          )}
        </TableCell>
      </TableRow>
    </TableBody>
  );
}
