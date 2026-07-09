import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  sortKey: string | null;
  sortDir: "asc" | "desc";
  onClear: () => void;
}

const SORT_LABEL_MAP: Record<string, string> = {
  expediente: "Expediente",
  cliente: "Cliente",
  modo: "Modo",
  estado: "Estado",
  etd: "ETD",
  eta: "ETA",
  operador: "Operador",
};

/**
 * v13.223.0 · Capa 3 Tranche A · 2.3:
 * "Quitar orden" migrado de link azul plano a `<Button variant="ghost">`
 * con icono `X`, alineado con el patrón del sistema para acciones inline.
 */
export function EmbarquesSortIndicator({ sortKey, sortDir, onClear }: Props) {
  if (!sortKey) return null;
  const label = `Ordenado por ${SORT_LABEL_MAP[sortKey] ?? sortKey} ${sortDir === "asc" ? "↑" : "↓"} · global`;
  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b bg-muted/20">
      <span>{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="h-6 gap-1 text-xs px-2"
      >
        <X className="h-3 w-3" />
        Quitar orden
      </Button>
    </div>
  );
}
