/**
 * Combobox de búsqueda server-side para Lead/Oportunidad usado en
 * `NuevaActividadDialog`.
 *
 * v13.821.7 (P2-7): el `<Select>` anterior sólo pedía las primeras 100
 * leads / 200 oportunidades (`pageSize`), así que cualquier registro fuera
 * de ese rango era inencontrable. Aquí cada tecleo dispara (con debounce)
 * una búsqueda al servidor vía `useLeads`/`useOportunidades` — el mismo
 * patrón de `search` server-side que ya usan esos hooks en sus listados.
 */
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useLeads, useOportunidades } from "@/features/crm/hooks";
import type { CrmLeadEstado } from "@/features/crm/domain/leads/constants";

interface Opcion { id: string; label: string; }

interface BaseProps {
  value: string;
  selectedLabel: string;
  placeholder: string;
  emptyLabel: string;
  opciones: Opcion[];
  isLoading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (o: Opcion) => void;
}

/** UI compartida del combobox — sin conocimiento de leads/oportunidades. */
function ComboboxBase({
  value, selectedLabel, placeholder, emptyLabel, opciones, isLoading, search, onSearchChange, onSelect,
}: BaseProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button" variant="outline" role="combobox" aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar…" value={search} onValueChange={onSearchChange} />
          <CommandList>
            <CommandEmpty>{isLoading ? "Buscando…" : emptyLabel}</CommandEmpty>
            <CommandGroup>
              {opciones.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  onSelect={() => { onSelect(o); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Metadatos del lead seleccionado (dueño canónico del prospecto). */
export interface LeadComboboxMeta {
  vendedor_id: string | null;
  vendedor_email: string;
}

interface ComboProps {
  value: string;
  onChange: (id: string, label: string) => void;
  placeholder?: string;
}

/**
 * v13.823.51 — la etiqueta interna sobrevivía a un `value` externo limpiado o
 * cambiado: el botón seguía mostrando el nombre anterior. Se sincroniza.
 */
function useEtiquetaSincronizada(value: string) {
  const [selectedLabel, setSelectedLabel] = useState("");
  const [labelDeId, setLabelDeId] = useState("");
  const etiqueta = value && labelDeId === value ? selectedLabel : "";
  const registrar = (id: string, label: string) => { setLabelDeId(id); setSelectedLabel(label); };
  return { etiqueta, registrar };
}

/** Selector de Lead con búsqueda server-side (no carga la lista completa). */
export function LeadComboboxCrm({
  value, onChange, placeholder = "Selecciona un lead…", estadoIn,
}: Omit<ComboProps, "onChange"> & {
  estadoIn?: CrmLeadEstado[];
  onChange: (id: string, label: string, meta?: LeadComboboxMeta) => void;
}) {
  const [search, setSearch] = useState("");
  const { etiqueta, registrar } = useEtiquetaSincronizada(value);
  const debounced = useDebouncedValue(search, 300);
  const { data, isFetching } = useLeads({ search: debounced, pageSize: 30, estadoIn });
  const filas = data?.data ?? [];
  const opciones: Opcion[] = filas.map((l) => ({ id: l.id, label: l.empresa }));
  return (
    <ComboboxBase
      value={value}
      selectedLabel={etiqueta}
      placeholder={placeholder}
      emptyLabel="Sin leads con ese nombre."
      opciones={opciones}
      isLoading={isFetching}
      search={search}
      onSearchChange={setSearch}
      onSelect={(o) => {
        registrar(o.id, o.label);
        const fila = filas.find((l) => l.id === o.id);
        onChange(o.id, o.label, {
          vendedor_id: fila?.vendedor_id ?? null,
          vendedor_email: fila?.vendedor_email ?? "",
        });
      }}
    />
  );
}

/** Selector de Oportunidad con búsqueda server-side. */
export function OportunidadComboboxCrm({ value, onChange, placeholder = "Selecciona una oportunidad…" }: ComboProps) {
  const [search, setSearch] = useState("");
  const { etiqueta, registrar } = useEtiquetaSincronizada(value);
  const debounced = useDebouncedValue(search, 300);
  const { data, isFetching } = useOportunidades({ search: debounced, pageSize: 30 });
  const opciones: Opcion[] = (data?.data ?? []).map((o) => ({ id: o.id, label: o.nombre }));
  return (
    <ComboboxBase
      value={value}
      selectedLabel={etiqueta}
      placeholder={placeholder}
      emptyLabel="Sin oportunidades con ese nombre."
      opciones={opciones}
      isLoading={isFetching}
      search={search}
      onSearchChange={setSearch}
      onSelect={(o) => { registrar(o.id, o.label); onChange(o.id, o.label); }}
    />
  );
}
