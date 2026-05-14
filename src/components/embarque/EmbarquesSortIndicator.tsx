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

export function EmbarquesSortIndicator({ sortKey, sortDir, onClear }: Props) {
  if (!sortKey) return null;
  const label = `Ordenado por ${SORT_LABEL_MAP[sortKey] ?? sortKey} ${sortDir === "asc" ? "↑" : "↓"} · global`;
  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b bg-muted/20">
      <span>{label}</span>
      <button
        type="button"
        onClick={onClear}
        className="text-primary hover:underline"
      >
        Quitar orden
      </button>
    </div>
  );
}
