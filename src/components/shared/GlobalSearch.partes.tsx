/**
 * Piezas presentacionales del buscador global. Extraídas de `GlobalSearch.tsx`
 * para respetar Power of 10 (≤ 200 líneas por archivo).
 */
import { SearchX, History, Loader2 } from "lucide-react";
import { CommandFooter, CommandGroup, CommandItem, CommandKey } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Hint } from "@/components/shared/Hint";

import type { GlobalSearchResult } from "@/hooks/shared";
import { ICONO_FILA, typeIcons, typeLabels } from "./globalSearchMeta";
import { resaltarCoincidencias } from "./globalSearchResaltado";

/** Texto con las coincidencias de la búsqueda resaltadas. */
export function TextoResaltado({ texto, termino }: { texto: string; termino: string }) {
  return (
    <>
      {resaltarCoincidencias(texto, termino).map((seg, i) =>
        seg.coincide ? (
          <mark
            key={i}
            className="rounded-sm bg-accent/20 px-0.5 font-semibold text-accent-foreground"
          >
            {seg.texto}
          </mark>
        ) : (
          <span key={i}>{seg.texto}</span>
        ),
      )}
    </>
  );
}



/** Skeletons mientras la búsqueda está en progreso. */
export function GlobalSearchCargando() {
  return (
    <div
      className="flex flex-col gap-2 p-2"
      role="status"
      aria-live="polite"
      data-testid="global-search-cargando"
    >
      <span className="flex items-center gap-2 px-1 text-body-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Buscando…
      </span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-md px-1 py-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface GlobalSearchVacioProps {
  busquedaFallo: boolean;
  enCrm?: boolean;
  atajoCrm?: string;
}

/** Estado vacío: distingue "sin resultados" de un fallo de red. */
export function GlobalSearchVacio({ busquedaFallo, enCrm, atajoCrm }: GlobalSearchVacioProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <SearchX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      {busquedaFallo ? (
        <>
          <p className="text-body font-medium text-foreground">No pudimos completar la búsqueda</p>
          <p className="text-body-sm text-muted-foreground">
            Revisa tu conexión y vuelve a escribir el término para reintentar.
          </p>
        </>
      ) : (
        <>
          <p className="text-body font-medium text-foreground">No se encontraron resultados</p>
          <p className="text-body-sm text-muted-foreground text-center px-4">
            Este buscador encuentra embarques, clientes, proveedores y facturas.
          </p>
          {enCrm && atajoCrm && (
            <p className="text-body-sm text-muted-foreground text-center px-4" data-testid="global-search-crm-hint">
              Para leads, oportunidades y actividades usa{" "}
              <CommandKey>{atajoCrm}</CommandKey>.
            </p>
          )}
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
  /** Término escrito por el usuario, para resaltar las coincidencias. */
  termino?: string;
}

/** Grupo de resultados de un tipo (embarques, clientes, etc.). */
export function GlobalSearchGrupo({ type, items, onSelect, termino = "" }: GrupoProps) {
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
            <p className="truncate font-semibold leading-tight">
              <TextoResaltado texto={item.label} termino={termino} />
            </p>
            {item.sublabel && (
              <Hint label={item.sublabel}>
                <p className="truncate text-body-sm text-muted-foreground">
                  <TextoResaltado texto={item.sublabel} termino={termino} />
                </p>
              </Hint>
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
