import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  sortKey: string | null;
  sortDir: "asc" | "desc";
  onClear: () => void;
  onSortChange: (key: string, dir: "asc" | "desc") => void;
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
export function EmbarquesSortIndicator({ sortKey, sortDir, onClear, onSortChange }: Props) {
  if (!sortKey) return null;
  const label = `Ordenado por ${SORT_LABEL_MAP[sortKey] ?? sortKey} ${sortDir === "asc" ? "↑" : "↓"} · global`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-body-sm text-muted-foreground border-b bg-muted/20">
      <span className="hidden md:inline">{label}</span>
      <div className="flex w-full items-center gap-2 md:hidden">
        <Select value={sortKey} onValueChange={(key) => onSortChange(key, sortDir)}>
          <SelectTrigger aria-label="Ordenar embarques por" className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABEL_MAP).map(([key, value]) => <SelectItem key={key} value={key}>{value}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortDir} onValueChange={(dir: "asc" | "desc") => onSortChange(sortKey, dir)}>
          <SelectTrigger aria-label="Dirección del orden" className="w-[145px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="asc">Ascendente</SelectItem><SelectItem value="desc">Descendente</SelectItem></SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="h-9 gap-1 text-body-sm px-2"
      >
        <X className="h-3 w-3" />
        Restablecer orden
      </Button>
    </div>
  );
}
