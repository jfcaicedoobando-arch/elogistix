/**
 * Piezas presentacionales del buscador global. Extraídas de `GlobalSearch.tsx`
 * para respetar Power of 10 (≤ 200 líneas por archivo).
 */
import { SearchX, History } from "lucide-react";
import { CommandFooter, CommandGroup, CommandItem, CommandKey } from "@/components/ui/command";
import type { GlobalSearchResult } from "@/hooks/shared";
import { ICONO_FILA, typeIcons, typeLabels } from "./globalSearchMeta";


/** Estado vacío: distingue "sin resultados" de un fallo de red. */
export function GlobalSearchVacio({ busquedaFallo }: { busquedaFallo: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <SearchX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      {busquedaFallo ? (
        <>
          <p className="text-sm font-medium text-foreground">No pudimos completar la búsqueda</p>
          <p className="text-xs text-muted-foreground">
            Revisa tu conexión y vuelve a escribir el término para reintentar.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">No se encontraron resultados</p>
          <p className="text-xs text-muted-foreground">
            Intenta con el expediente, el BL/Guía, el RFC o el folio de la factura.
          </p>
        </>
      )}
    </div>
  );
}

interface RecientesProps {
  recents: { url: string; title: string }[];
  onSelect: (url: string, title?: string) => void;
}

/** Grupo "Recientes" que se muestra cuando el input está vacío. */
export function GlobalSearchRecientes({ recents, onSelect }: RecientesProps) {
  return (
    <CommandGroup heading="Recientes">
      {recents.map((item) => (
        <CommandItem
          key={`recent-${item.url}`}
          value={`reciente ${item.title}`.toLowerCase()}
          onSelect={() => onSelect(item.url, item.title)}
        >
          <History className={ICONO_FILA} aria-hidden="true" />
          <span className="font-semibold truncate">{item.title}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

interface GrupoProps {
  type: string;
  items: GlobalSearchResult[];
  onSelect: (url: string, title?: string) => void;
}

/** Grupo de resultados de un tipo (embarques, clientes, etc.). */
export function GlobalSearchGrupo({ type, items, onSelect }: GrupoProps) {
  const Icon = typeIcons[type as keyof typeof typeIcons];
  return (
    <CommandGroup heading={typeLabels[type as keyof typeof typeLabels]}>
      {items.map((item) => (
        <CommandItem
          key={item.id}
          value={`${item.label} ${item.sublabel ?? ""} ${type}`.toLowerCase()}
          onSelect={() => onSelect(item.url, item.label)}
        >
          <Icon className={ICONO_FILA} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{item.label}</p>
            {item.sublabel && (
              <p className="truncate text-xs text-muted-foreground" title={item.sublabel}>
                {item.sublabel}
              </p>
            )}
          </div>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

/** Pie con los atajos de teclado del diálogo. */
export function GlobalSearchAtajos() {
  return (
    <CommandFooter>
      <span className="flex items-center gap-1.5">
        <CommandKey>↑</CommandKey>
        <CommandKey>↓</CommandKey>
        navegar
      </span>
      <span className="flex items-center gap-1.5">
        <CommandKey>↵</CommandKey>
        abrir
      </span>
      <span className="flex items-center gap-1.5">
        <CommandKey>esc</CommandKey>
        cerrar
      </span>
    </CommandFooter>
  );
}
