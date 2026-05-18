import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Ship, Users, Truck, FileText, ClipboardList } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useGlobalSearch, type GlobalSearchResult } from "@/hooks/shared";

type SearchResult = GlobalSearchResult;

const typeIcons = {
  embarque: Ship,
  cliente: Users,
  proveedor: Truck,
  factura: FileText,
  cotizacion: ClipboardList,
};

const typeLabels = {
  embarque: "Embarques",
  cliente: "Clientes",
  proveedor: "Proveedores",
  factura: "Facturas",
  cotizacion: "Cotizaciones",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const search = useGlobalSearch();

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

  useEffect(() => {
    const timer = setTimeout(() => buscar(query), 300);
    return () => clearTimeout(timer);
  }, [query, buscar]);

  const handleSelect = (url: string) => {
    setOpen(false);
    setQuery("");
    navigate(url);
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, resultado) => {
    (acc[resultado.type] = acc[resultado.type] || []).push(resultado);
    return acc;
  }, {});

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden sm:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar embarques, clientes, proveedores, facturas..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No se encontraron resultados.</CommandEmpty>
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = typeIcons[type as keyof typeof typeIcons];
            return (
              <CommandGroup key={type} heading={typeLabels[type as keyof typeof typeLabels]}>
                {items.map((item) => (
                  <CommandItem key={item.id} value={`${item.label} ${item.sublabel ?? ""} ${type}`.toLowerCase()} onSelect={() => handleSelect(item.url)}>
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
