import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PnlView } from "./embarqueDetalleTabsTypes";

interface Props {
  visible: boolean;
  value: PnlView;
  onChange: (value: PnlView) => void;
}

export function PnlViewSelector({ visible, value, onChange }: Props) {
  if (!visible) return null;
  return (
    <div className="flex items-center justify-end">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(next) => { if (next) onChange(next as PnlView); }}
      >
        <ToggleGroupItem value="global" aria-label="Vista global">Global</ToggleGroupItem>
        <ToggleGroupItem value="contenedor" aria-label="Vista por contenedor">Por contenedor</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}