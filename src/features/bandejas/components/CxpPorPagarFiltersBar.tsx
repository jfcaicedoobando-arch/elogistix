import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { rangoLabel } from "@/lib/ui/rangoFechasCopy";
import { FILTRO_ANCHO } from "@/lib/ui/filterWidths";

export interface CxpPorPagarFiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  vencidas: string;
  onVencidasChange: (v: string) => void;
  moneda: string;
  onMonedaChange: (v: string) => void;
  monedas: string[];
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;

  chips: { key: string; label: string; onRemove: () => void }[];
  activeCount: number;
  onClearAll: () => void;
}

export function CxpPorPagarFiltersBar(props: CxpPorPagarFiltersBarProps) {
  const applied = {
    vencidas: props.vencidas, moneda: props.moneda,
    dateFrom: props.dateFrom, dateTo: props.dateTo,
  };
  const [draft, setDraft] = useState(applied);
  const updateDraft = (key: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const apply = () => {
    if (draft.vencidas !== props.vencidas) props.onVencidasChange(draft.vencidas);
    if (draft.moneda !== props.moneda) props.onMonedaChange(draft.moneda);
    if (draft.dateFrom !== props.dateFrom) props.onDateFromChange(draft.dateFrom);
    if (draft.dateTo !== props.dateTo) props.onDateToChange(draft.dateTo);
  };

  return (
    <UnifiedFiltersBar
      search={props.search}
      onSearchChange={props.onSearchChange}
      searchPlaceholder="Buscar proveedor, folio o expediente…"
      primary={<PrimaryFilters {...props} />}
      sheetPrimary={
        <PrimaryFilters
          {...props}
          vencidas={draft.vencidas}
          moneda={draft.moneda}
          onVencidasChange={(v) => updateDraft("vencidas", v)}
          onMonedaChange={(v) => updateDraft("moneda", v)}
        />
      }
      secondary={
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cxp-from">{rangoLabel("Vencimiento", "desde")}</Label>
            <DatePickerMx value={draft.dateFrom} onChange={(v) => updateDraft("dateFrom", v)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cxp-to">{rangoLabel("Vencimiento", "hasta")}</Label>
            <DatePickerMx value={draft.dateTo} onChange={(v) => updateDraft("dateTo", v)} />
          </div>
        </div>
      }
      onSheetOpenChange={(open) => { if (open) setDraft(applied); }}
      onApply={apply}
      onSheetClearAll={() => setDraft({ vencidas: "todas", moneda: "todas", dateFrom: "", dateTo: "" })}
      sheetActiveCount={Number(draft.vencidas !== "todas") + Number(draft.moneda !== "todas") +
        Number(Boolean(draft.dateFrom)) + Number(Boolean(draft.dateTo))}
      chips={props.chips}
      activeCount={props.activeCount}
      onClearAll={props.onClearAll}
    />
  );
}

function PrimaryFilters(props: Pick<CxpPorPagarFiltersBarProps,
  "vencidas" | "onVencidasChange" | "moneda" | "onMonedaChange" | "monedas"
>) {
  return (
    <>
      <Select value={props.vencidas} onValueChange={props.onVencidasChange}>
        <SelectTrigger className={FILTRO_ANCHO.md} aria-label="Vencidas">
          <SelectValue placeholder="Vencidas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas</SelectItem>
          <SelectItem value="si">Solo vencidas</SelectItem>
          <SelectItem value="no">Vigentes</SelectItem>
        </SelectContent>
      </Select>
      <Select value={props.moneda} onValueChange={props.onMonedaChange}>
        <SelectTrigger className={FILTRO_ANCHO.sm} aria-label="Moneda">
          <SelectValue placeholder="Moneda" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas las monedas</SelectItem>
          {props.monedas.map((m) => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
