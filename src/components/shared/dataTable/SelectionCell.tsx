import { Checkbox } from "@/components/ui/checkbox";

interface RowProps {
  checked: boolean;
  onToggle: () => void;
}

export function SelectionCell({ checked, onToggle }: RowProps) {
  return (
    <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label="Seleccionar fila" />
    </div>
  );
}

interface HeaderProps {
  checked: boolean;
  indeterminate: boolean;
  onToggle: () => void;
}

export function SelectionHeader({ checked, indeterminate, onToggle }: HeaderProps) {
  return (
    <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
      <Checkbox
        checked={indeterminate ? "indeterminate" : checked}
        onCheckedChange={onToggle}
        aria-label="Seleccionar todas las filas visibles"
      />
    </div>
  );
}
