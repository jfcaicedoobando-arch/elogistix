/**
 * Lista paginada (servidor) con búsqueda para Empresas o Contactos del CRM.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/shared/states/ErrorState";
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
  const navigate = useNavigate();
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

  if (q.isError) {
    return <ErrorState title="No se pudo cargar la lista" description="Intenta de nuevo." onRetry={() => void q.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8" placeholder={placeholder} value={texto}
          onChange={(e) => { setTexto(e.target.value); setPagina(0); }}
          aria-label={placeholder}
        />
      </div>
      {conPuntaje && <FiltroLetraSelect value={letra} onChange={(v) => { setLetra(v); setPagina(0); }} />}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>{cols.map((c) => <TableHead key={c.titulo}>{c.titulo}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow><TableCell colSpan={cols.length} className="text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {!q.isLoading && q.data?.filas.length === 0 && (
              <TableRow><TableCell colSpan={cols.length} className="text-muted-foreground">Sin resultados.</TableCell></TableRow>
            )}
            {q.data?.filas.map((f) => (
              <TableRow key={f.id} className="cursor-pointer" onClick={() => navigate(`${rutaBase}/${f.id}`)}>
                {cols.map((c) => <TableCell key={c.titulo}>{c.celda(f)}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-body-sm text-muted-foreground">
        <span>{total.toLocaleString("es-MX")} registros</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
          <span>Página {pagina + 1} de {paginas}</span>
          <Button size="sm" variant="outline" disabled={pagina + 1 >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</Button>
        </div>
      </div>
    </div>
  );
}
