/**
 * CrmCommandPalette — paleta Cmd+P para navegar a leads, oportunidades o actividades.
 * Se abre/cierra con `open` y notifica con `onOpenChange`.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Target, ClipboardList } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/shared";
import { useCrmSearch } from "@/features/crm/hooks";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function CrmCommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 200);
  const { data: hits = [], isFetching, isError, refetch } = useCrmSearch(debounced);

  useEffect(() => { if (!open) setTerm(""); }, [open]);

  const go = (path: string) => { onOpenChange(false); navigate(path); };

  const leads = hits.filter((h) => h.kind === "lead");
  const ops = hits.filter((h) => h.kind === "oportunidad");
  const acts = hits.filter((h) => h.kind === "actividad");

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput value={term} onValueChange={setTerm} placeholder="Buscar leads, oportunidades, actividades…" />
      <CommandList>
        {isError ? (
          <div className="p-4 flex flex-col items-center gap-2 text-center">
            <p className="text-body-sm text-destructive">No se pudo buscar. Intenta de nuevo.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button>
          </div>
        ) : debounced.length < 2 ? (
          <div className="p-4 text-body-sm text-muted-foreground">Escribe al menos 2 caracteres…</div>
        ) : isFetching ? (
          <div className="p-4 text-body-sm text-muted-foreground">Buscando…</div>
        ) : hits.length === 0 ? (
          <CommandEmpty>Sin resultados</CommandEmpty>
        ) : null}
        {leads.length > 0 && (
          <CommandGroup heading="Leads">
            {leads.map((h) => (
              <CommandItem key={`l-${h.id}`} value={`lead-${h.id}-${h.title}`} onSelect={() => go(`/crm/leads/${h.id}`)}>
                <UserPlus className="h-4 w-4 mr-2" />
                <div className="flex-1 min-w-0">
                  <div className="text-body truncate">{h.title}</div>
                  <div className="text-label text-muted-foreground truncate">{h.subtitle}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {ops.length > 0 && (
          <CommandGroup heading="Oportunidades">
            {ops.map((h) => (
              <CommandItem key={`o-${h.id}`} value={`op-${h.id}-${h.title}`} onSelect={() => go(`/crm/oportunidades/${h.id}`)}>
                <Target className="h-4 w-4 mr-2" />
                <div className="flex-1 min-w-0">
                  <div className="text-body truncate">{h.title}</div>
                  <div className="text-label text-muted-foreground truncate">{h.subtitle}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {acts.length > 0 && (
          <CommandGroup heading="Actividades pendientes">
            {acts.map((h) => (
              <CommandItem key={`a-${h.id}`} value={`act-${h.id}-${h.title}`} onSelect={() => go(`/crm/actividades`)}>
                <ClipboardList className="h-4 w-4 mr-2" />
                <div className="flex-1 min-w-0">
                  <div className="text-body truncate">{h.title}</div>
                  <div className="text-label text-muted-foreground truncate">{h.subtitle}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
