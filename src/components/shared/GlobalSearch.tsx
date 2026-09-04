import { useEffect, useState, useCallback, useDeferredValue, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { atajoBusquedaGlobal, atajoCrmPalette } from "@/lib/ui/atajoTeclado";
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import { useGlobalSearch, type GlobalSearchResult } from "@/hooks/shared";
import { useRecentPages } from "@/hooks/shared/useRecentPages";
import { useDebouncedValue } from "@/lib/hooks";
import { trackNavEvent } from "@/services/observability/trackNavEvent";
import { useAuth } from "@/lib/contexts/AuthContext";
import { buscarPaginas } from "@/features/search/domain/paginas";
import {
  GlobalSearchAtajos,
  GlobalSearchCargando,
  GlobalSearchGrupo,
  GlobalSearchRecientes,
  GlobalSearchVacio,
} from "./GlobalSearch.partes";


type SearchResult = GlobalSearchResult;

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busquedaFallo, setBusquedaFallo] = useState(false);
  const [buscando, setBuscando] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const search = useGlobalSearch();
  const { recents } = useRecentPages();
  const { effectiveRole } = useAuth();
  const enCrm = location.pathname.startsWith("/crm");

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

  // EC-05: token por request para descartar respuestas viejas que resuelven
  // fuera de orden (race condition: término viejo sobrescribía al actual).
  const requestIdRef = useRef(0);

  const buscar = useCallback(async (terminoBusqueda: string) => {
    const requestId = ++requestIdRef.current;
    setBuscando(true);
    try {
      const items = await search(terminoBusqueda, 5);
      if (requestId !== requestIdRef.current) return;
      setResults(items);
      setBusquedaFallo(false);
    } catch {
      if (requestId !== requestIdRef.current) return;
      // R7-FIX1: un fallo de red no debe verse igual que "sin resultados".
      setResults([]);
      setBusquedaFallo(true);
    } finally {
      if (requestId === requestIdRef.current) setBuscando(false);
    }
  }, [search]);


  const debouncedQuery = useDebouncedValue(query, 300);
  useEffect(() => {
    buscar(debouncedQuery);
  }, [debouncedQuery, buscar]);

  const handleSelect = useCallback((url: string, title?: string) => {
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
  }, [effectiveRole, navigate]);

  const deferredResults = useDeferredValue(results);
  const paginas = useMemo(
    () => buscarPaginas(debouncedQuery, effectiveRole),
    [debouncedQuery, effectiveRole],
  );
  const grouped = useMemo(
    () => [...deferredResults, ...paginas].reduce<Record<string, SearchResult[]>>((acc, resultado) => {
      (acc[resultado.type] = acc[resultado.type] || []).push(resultado);
      return acc;
    }, {}),
    [deferredResults, paginas],
  );

  const showRecents = query.trim() === "" && recents.length > 0;
  /** En progreso: el debounce aún no dispara o la consulta está en vuelo. */
  const cargando =
    query.trim() !== "" && (buscando || query.trim() !== debouncedQuery.trim());



  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="global-search-trigger"
        aria-label="Abrir búsqueda global"
        className="flex h-9 w-9 md:w-56 items-center gap-2 justify-center md:justify-start rounded-md border border-border bg-muted/50 px-0 md:px-3 text-body text-muted-foreground/90 hover:bg-muted hover:text-foreground transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Buscar…</span>
        <kbd className="hidden md:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-2xs font-medium text-muted-foreground">
          {atajoBusquedaGlobal()}
        </kbd>
      </button>

      {/* R7-FIX1: los resultados ya vienen filtrados por la BD; cmdk no debe
          volver a filtrarlos (ocultaba folios, RFC y BL con formato distinto).
          `loop`: las flechas ↑/↓ dan la vuelta para operar sin mouse. */}
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false} loop>

        <CommandInput
          placeholder="Buscar por expediente, BL, cliente, factura…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {!cargando && (
            <CommandEmpty>
              <GlobalSearchVacio busquedaFallo={busquedaFallo} />
            </CommandEmpty>
          )}

          {cargando && <GlobalSearchCargando />}

          {!cargando && showRecents && (
            <GlobalSearchRecientes recents={recents} onSelect={handleSelect} />
          )}
          {!cargando &&
            Object.entries(grouped).map(([type, items]) => (
              <GlobalSearchGrupo
                key={type}
                type={type}
                items={items}
                termino={debouncedQuery}
                onSelect={handleSelect}
              />
            ))}

        </CommandList>

        <GlobalSearchAtajos />
      </CommandDialog>
    </>
  );
}
