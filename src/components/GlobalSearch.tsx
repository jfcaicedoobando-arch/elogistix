import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Ship, Users, Truck, FileText } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: "embarque" | "cliente" | "proveedor" | "factura";
  url: string;
}

const typeIcons = {
  embarque: Ship,
  cliente: Users,
  proveedor: Truck,
  factura: FileText,
};

const typeLabels = {
  embarque: "Embarques",
  cliente: "Clientes",
  proveedor: "Proveedores",
  factura: "Facturas",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const pattern = `%${q}%`;
    const [embarques, clientes, proveedores, facturas] = await Promise.all([
      supabase.from("embarques").select("id, expediente, cliente_nombre").ilike("expediente", pattern).limit(5),
      supabase.from("clientes").select("id, nombre, rfc").or(`nombre.ilike.${pattern},rfc.ilike.${pattern}`).limit(5),
      supabase.from("proveedores").select("id, nombre, rfc").or(`nombre.ilike.${pattern},rfc.ilike.${pattern}`).limit(5),
      supabase.from("facturas").select("id, numero, cliente_nombre").or(`numero.ilike.${pattern},cliente_nombre.ilike.${pattern}`).limit(5),
    ]);

    const items: SearchResult[] = [
      ...(embarques.data ?? []).map((e) => ({ id: e.id, label: e.expediente, sublabel: e.cliente_nombre, type: "embarque" as const, url: `/embarques/${e.id}` })),
      ...(clientes.data ?? []).map((c) => ({ id: c.id, label: c.nombre, sublabel: c.rfc, type: "cliente" as const, url: `/clientes/${c.id}` })),
      ...(proveedores.data ?? []).map((p) => ({ id: p.id, label: p.nombre, sublabel: p.rfc, type: "proveedor" as const, url: `/proveedores/${p.id}` })),
      ...(facturas.data ?? []).map((f) => ({ id: f.id, label: f.numero, sublabel: f.cliente_nombre, type: "factura" as const, url: `/facturacion` })),
    ];
    setResults(items);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (url: string) => {
    setOpen(false);
    setQuery("");
    navigate(url);
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] = acc[r.type] || []).push(r);
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
                  <CommandItem key={item.id} onSelect={() => handleSelect(item.url)}>
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
