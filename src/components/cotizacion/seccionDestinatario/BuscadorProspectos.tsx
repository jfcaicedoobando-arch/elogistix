/**
 * Buscador con debounce de leads/oportunidades existentes.
 */
import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/shared/useDebounce";
import { useCrmProspectoSearch, type ProspectoMatch } from "@/hooks/crm/useCrmProspectoSearch";

interface Props {
  onSelect: (m: ProspectoMatch) => void;
}

export function BuscadorProspectos({ onSelect }: Props) {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 200);
  const { data, isFetching } = useCrmProspectoSearch(debounced);
  const items = useMemo(() => data ?? [], [data]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por empresa, contacto, email…"
          className="pl-8"
          autoFocus
        />
      </div>
      {debounced.length < 2 ? (
        <p className="text-xs text-muted-foreground">
          Escribe al menos 2 caracteres para buscar.
        </p>
      ) : isFetching ? (
        <p className="text-xs text-muted-foreground">Buscando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sin resultados. Cambia el modo a "Crear nuevo prospecto" para registrarlo.
        </p>
      ) : (
        <ul className="max-h-60 overflow-auto rounded-md border bg-background divide-y">
          {items.map((m) => (
            <li key={`${m.kind}-${m.id}`}>
              <button
                type="button"
                onClick={() => onSelect(m)}
                className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-muted/60"
              >
                <Badge
                  variant="outline"
                  className={
                    m.kind === "oportunidad"
                      ? "border-primary/40 text-primary"
                      : "border-muted-foreground/40"
                  }
                >
                  {m.kind === "oportunidad" ? "Oport." : "Lead"}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.empresa}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.contacto || m.email || "—"}
                    {m.etapaNombre ? ` · ${m.etapaNombre}` : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
