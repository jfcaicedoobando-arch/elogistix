/**
 * Encabezado de columna ordenable para la tabla de TabVsReal.
 */
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { SortDir } from "@/features/presupuesto/components/vsRealSort";

import { DetailTableHead } from "@/components/shared/DetailTable";
export function ThSort({ label, active, dir, onClick, align = "left" }: {
  label: string; active: boolean; dir: SortDir; onClick: () => void; align?: "left" | "right";
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <DetailTableHead className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
        {label} <Icon className="h-3 w-3" />
      </button>
    </DetailTableHead>
  );
}
