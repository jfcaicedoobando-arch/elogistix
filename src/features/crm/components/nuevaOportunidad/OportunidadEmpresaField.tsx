import { useState } from "react";
import { Building2, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useDebounce } from "@/hooks/shared";
import { useEmpresasCrm } from "@/features/crm/hooks/useObjetosCrm";
import { OBJETOS_PAGE_SIZE, type RefRow } from "@/features/crm/services/objetosCrm";

interface Props {
  empresa: RefRow | null;
  onChange: (empresa: RefRow) => void;
  disabled?: boolean;
}

export function OportunidadEmpresaField({ empresa, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(0);
  const term = useDebounce(texto, 300);
  const q = useEmpresasCrm(term, pagina);
  const total = q.data?.total ?? 0;
  return (
    <div className="space-y-1">
      <Label htmlFor="op-empresa">Empresa asociada *</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id="op-empresa" type="button" variant="outline" role="combobox"
            aria-expanded={open} aria-required="true" disabled={disabled} className="w-full justify-between">
            <Building2 className="size-4 shrink-0" />
            <span className="truncate">{empresa?.nombre || "Selecciona una empresa…"}</span>
            <ChevronsUpDown className="size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-80 max-w-[calc(100vw-2rem)]" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar empresa…" value={texto}
              onValueChange={(v) => { setTexto(v); setPagina(0); }} />
            <CommandList>
              {q.isError ? <p role="alert" className="p-3 text-body-sm text-destructive">No se pudieron cargar las empresas.</p> : (
                <>
                  <CommandEmpty>{q.isFetching ? "Buscando…" : "Sin resultados"}</CommandEmpty>
                  <CommandGroup>
                    {(q.data?.filas ?? []).map((e) => <CommandItem key={e.id} value={e.id} disabled={q.isFetching}
                      onSelect={() => { onChange({ id: e.id, nombre: e.nombre }); setOpen(false); }}>
                      {e.nombre}
                    </CommandItem>)}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
          <div className="flex items-center justify-between border-t p-2">
            <Button type="button" variant="ghost" size="icon" aria-label="Empresas anteriores"
              disabled={pagina === 0 || q.isFetching} onClick={() => setPagina((p) => p - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-body-sm text-muted-foreground">Página {pagina + 1}</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Empresas siguientes"
              disabled={q.isFetching || (pagina + 1) * OBJETOS_PAGE_SIZE >= total} onClick={() => setPagina((p) => p + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}