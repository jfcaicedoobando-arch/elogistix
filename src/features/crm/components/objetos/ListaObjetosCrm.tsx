/**
 * Lista paginada (servidor) con búsqueda para Empresas o Contactos del CRM.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { useDebounce } from "@/hooks/shared";
import { OBJETOS_PAGE_SIZE, type Pagina } from "@/features/crm/services/objetosCrm";
import type { UseQueryResult } from "@tanstack/react-query";
import { useListaObjetosCrm } from "@/features/crm/hooks/useObjetosCrm";
import { usePuntajes } from "@/features/crm/hooks/useScoringCrm";
import { FiltroLetraSelect } from "@/features/crm/components/scoring/FiltroLetraSelect";
import { InsigniaPuntaje } from "@/features/crm/components/scoring/InsigniaPuntaje";

export interface Columna<T> { titulo: string; celda: (fila: T) => ReactNode }

interface Props<T extends { id: string }> {
  placeholder: string;
  rutaBase: string;
  columnas: Columna<T>[];
  objeto: "empresa" | "contacto";
}

export function ListaObjetosCrm<T extends { id: string }>({ placeholder, rutaBase, columnas, objeto }: Props<T>) {
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(0);
  const [letra, setLetra] = useState("todas");
  const busqueda = useDebounce(texto, 300);
  // SAFE-CAST: `objeto` determina el tipo de fila que devuelve el servicio.
  const q = useListaObjetosCrm(objeto, busqueda, pagina, letra) as UseQueryResult<Pagina<T>>;
  const conPuntaje = objeto === "empresa";
  const ids = useMemo(() => (conPuntaje ? q.data?.filas.map((f) => f.id) ?? [] : []), [conPuntaje, q.data]);
  const { data: puntajes } = usePuntajes("empresa", ids);
  const cols: Columna<T>[] = conPuntaje
    ? [...columnas, { titulo: "Puntaje", celda: (f) => <InsigniaPuntaje letra={puntajes?.get(f.id)?.letra} puntaje={puntajes?.get(f.id)?.puntaje} /> }]
    : columnas;
  const total = q.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / OBJETOS_PAGE_SIZE));

  const tableColumns = defineColumns<T>(cols.map((c) => ({
    id: c.titulo, header: c.titulo, enableSorting: false,
    cell: ({ row }) => c.celda(row.original),
  })));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-8" placeholder={placeholder} value={texto}
          onChange={(e) => { setTexto(e.target.value); setPagina(0); }}
          aria-label={placeholder}
        />
      </div>
      {conPuntaje && <FiltroLetraSelect value={letra} onChange={(v) => { setLetra(v); setPagina(0); }} />}
      </div>
      <div className="rounded-md border">
        <DataTable columns={tableColumns} data={q.data?.filas ?? []} rowKey={(f) => f.id}
          getRowHref={(f) => `${rutaBase}/${f.id}`} isLoading={q.isLoading} isError={q.isError}
          onRetry={() => void q.refetch()} density={TABLE_DENSITY.listado} sortMode="server"
          emptyMessage="Sin resultados." pagination={{ page: pagina, totalPages: paginas,
            onPageChange: setPagina, pageSize: OBJETOS_PAGE_SIZE, total }} />
      </div>
    </div>
  );
}
