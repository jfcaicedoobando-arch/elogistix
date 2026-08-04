import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { rangoLabel } from "@/lib/ui/rangoFechasCopy";

export interface CxpPorPagarFiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  vencidas: string;
  onVencidasChange: (v: string) => void;
  moneda: string;
  onMonedaChange: (v: string) => void;
  monedas: string[];
  dateFrom: string | undefined;
  onDateFromChange: (v: string | undefined) => void;
  dateTo: string | undefined;
  onDateToChange: (v: string | undefined) => void;
  chips: { key: string; label: string; onRemove: () => void }[];
  activeCount: number;
  onClearAll: () => void;
}

export function CxpPorPagarFiltersBar(props: CxpPorPagarFiltersBarProps) {
  return (
    <UnifiedFiltersBar
      search={props.search}
      onSearchChange={props.onSearchChange}
      searchPlaceholder="Buscar proveedor, folio o expediente…"
      primary={
        <>
          <Select value={props.vencidas} onValueChange={props.onVencidasChange}>
            <SelectTrigger className="w-[160px]" aria-label="Vencidas">
              <SelectValue placeholder="Vencidas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="si">Solo vencidas</SelectItem>
              <SelectItem value="no">Vigentes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={props.moneda} onValueChange={props.onMonedaChange}>
            <SelectTrigger className="w-[140px]" aria-label="Moneda">
              <SelectValue placeholder="Moneda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas monedas</SelectItem>
              {props.monedas.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      secondary={
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cxp-from">{rangoLabel("Vencimiento", "desde")}</Label>
            <DatePickerMx value={props.dateFrom} onChange={props.onDateFromChange} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cxp-to">{rangoLabel("Vencimiento", "hasta")}</Label>
            <DatePickerMx value={props.dateTo} onChange={props.onDateToChange} />
          </div>
        </div>
      }
      chips={props.chips}
      activeCount={props.activeCount}
      onClearAll={props.onClearAll}
    />
  );
}
