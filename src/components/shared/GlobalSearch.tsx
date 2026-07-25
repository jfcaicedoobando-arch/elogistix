import { useEffect, useState, useCallback, useDeferredValue, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Ship, Users, Truck, FileSpreadsheet, ClipboardList, Receipt, History } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useGlobalSearch, type GlobalSearchResult } from "@/hooks/shared";
import { useRecentPages } from "@/hooks/shared/useRecentPages";
import { useDebouncedValue } from "@/lib/hooks";
import { trackNavEvent } from "@/services/observability/trackNavEvent";
import { useAuth } from "@/lib/contexts/AuthContext";

type SearchResult = GlobalSearchResult;

const typeIcons = {
  embarque: Ship,
  cliente: Users,
  proveedor: Truck,
  factura: Receipt,
  factura_proveedor: Receipt,
  cotizacion: ClipboardList,
  proforma: FileSpreadsheet,
};

const typeLabels = {
  embarque: "Embarques",
  cliente: "Clientes",
  proveedor: "Proveedores",
  factura: "Facturas",
  factura_proveedor: "Facturas de proveedor",
  cotizacion: "Cotizaciones",
  proforma: "Proformas",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const search = useGlobalSearch();
  const { recents } = useRecentPages();
  const { effectiveRole } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((estaAbierto) => !estaAbierto);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const buscar = useCallback(async (terminoBusqueda: string) => {
    const items = await search(terminoBusqueda, 5);
    setResults(items);
  }, [search]);

  const debouncedQuery = useDebouncedValue(query, 300);
  useEffect(() => {
    buscar(debouncedQuery);
  }, [debouncedQuery, buscar]);


  const handleSelect = (url: string, title?: string) => {
    setOpen(false);
    setQuery("");
    trackNavEvent({
      source: "buscador",
      item_url: url,
      item_title: title ?? url,
      section_label: null,
      role: effectiveRole ?? null,
    });
    navigate(url);
  };

  const deferredResults = useDeferredValue(results);
  const grouped = useMemo(
    () => deferredResults.reduce<Record<string, SearchResult[]>>((acc, resultado) => {
      (acc[resultado.type] = acc[resultado.type] || []).push(resultado);
      return acc;
    }, {}),
    [deferredResults],
  );

  const showRecents = query.trim() === "" && recents.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="global-search-trigger"
        aria-label="Abrir búsqueda global"
        className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground/90 hover:bg-muted hover:text-foreground transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Buscar…</span>
        <kbd className="hidden md:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-2xs font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar por expediente, BL, cliente, factura…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No se encontraron resultados.</CommandEmpty>
          {showRecents && (
            <CommandGroup heading="Recientes">
              {recents.map((item) => (
                <CommandItem
                  key={`recent-${item.url}`}
                  value={`reciente ${item.title}`.toLowerCase()}
                  onSelect={() => handleSelect(item.url, item.title)}
                >
                  <History className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = typeIcons[type as keyof typeof typeIcons];
            return (
              <CommandGroup key={type} heading={typeLabels[type as keyof typeof typeLabels]}>
                {items.map((item) => (
                  <CommandItem key={item.id} value={`${item.label} ${item.sublabel ?? ""} ${type}`.toLowerCase()} onSelect={() => handleSelect(item.url, item.label)}>
                    <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{item.label}</span>
                    {item.sublabel && (
                      <span className="ml-2 text-xs text-muted-foreground truncate">{item.sublabel}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
