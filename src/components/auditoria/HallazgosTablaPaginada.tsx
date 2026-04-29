import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, ExternalLink, Search, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type {
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/hooks/auditoria/useAuditoria";

interface Props {
  hallazgos: HallazgoAuditoria[];
}

const reglaLabel: Record<ReglaAuditoria, string> = {
  docs_faltantes: "Docs faltantes",
  docs_pendientes_avanzado: "Docs pendientes (avanzado)",
  fechas: "Fechas inconsistentes",
  ventas_sin_facturar: "Ventas sin facturar",
};

const severidadConfig: Record<SeveridadAuditoria, { label: string; className: string }> = {
  critico: {
    label: "Crítico",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  alto: {
    label: "Alto",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  medio: {
    label: "Medio",
    className: "bg-primary/15 text-primary border-primary/30",
  },
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function formatEta(eta: string | null): string {
  if (!eta) return "—";
  const [y, m, d] = eta.split("-");
  return `${d}/${m}/${y}`;
}

export function HallazgosTablaPaginada({ hallazgos }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filtroRegla, setFiltroRegla] = useState<ReglaAuditoria | "todas">("todas");
  const [filtroSev, setFiltroSev] = useState<SeveridadAuditoria | "todas">("todas");
  const [filtroCliente, setFiltroCliente] = useState<string>("todos");
  const [etaDesde, setEtaDesde] = useState<Date | undefined>();
  const [etaHasta, setEtaHasta] = useState<Date | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const clientes = useMemo(() => {
    const set = new Set(
      hallazgos.map((h) => h.cliente_nombre).filter((c): c is string => !!c),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-MX"));
  }, [hallazgos]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    const desde = etaDesde ? etaDesde.toISOString().slice(0, 10) : null;
    const hasta = etaHasta ? etaHasta.toISOString().slice(0, 10) : null;
    return hallazgos.filter((h) => {
      if (q && !h.expediente?.toLowerCase().includes(q)) return false;
      if (filtroRegla !== "todas" && h.regla !== filtroRegla) return false;
      if (filtroSev !== "todas" && h.severidad !== filtroSev) return false;
      if (filtroCliente !== "todos" && h.cliente_nombre !== filtroCliente) return false;
      if (desde && (!h.eta || h.eta < desde)) return false;
      if (hasta && (!h.eta || h.eta > hasta)) return false;
      return true;
    });
  }, [hallazgos, search, filtroRegla, filtroSev, filtroCliente, etaDesde, etaHasta]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visibles = filtrados.slice(start, start + pageSize);

  const limpiar = () => {
    setSearch("");
    setFiltroRegla("todas");
    setFiltroSev("todas");
    setFiltroCliente("todos");
    setEtaDesde(undefined);
    setEtaHasta(undefined);
    setPage(1);
  };

  const hayFiltros =
    search ||
    filtroRegla !== "todas" ||
    filtroSev !== "todas" ||
    filtroCliente !== "todos" ||
    etaDesde ||
    etaHasta;

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-[280px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar expediente..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <Select
          value={filtroRegla}
          onValueChange={(v) => {
            setFiltroRegla(v as typeof filtroRegla);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="Regla" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las reglas</SelectItem>
            {(Object.keys(reglaLabel) as ReglaAuditoria[]).map((r) => (
              <SelectItem key={r} value={r}>
                {reglaLabel[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtroSev}
          onValueChange={(v) => {
            setFiltroSev(v as typeof filtroSev);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Severidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Severidad</SelectItem>
            <SelectItem value="critico">Crítico</SelectItem>
            <SelectItem value="alto">Alto</SelectItem>
            <SelectItem value="medio">Medio</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filtroCliente}
          onValueChange={(v) => {
            setFiltroCliente(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los clientes</SelectItem>
            {clientes.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 text-xs justify-start font-normal",
                !etaDesde && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {etaDesde ? format(etaDesde, "dd/MM/yyyy") : "ETA desde"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={etaDesde}
              onSelect={(d) => {
                setEtaDesde(d);
                setPage(1);
              }}
              locale={es}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 text-xs justify-start font-normal",
                !etaHasta && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {etaHasta ? format(etaHasta, "dd/MM/yyyy") : "ETA hasta"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={etaHasta}
              onSelect={(d) => {
                setEtaHasta(d);
                setPage(1);
              }}
              locale={es}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {hayFiltros && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={limpiar}>
            <X className="h-3.5 w-3.5 mr-1" />
            Limpiar
          </Button>
        )}

        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">{filtrados.length}</span> de{" "}
          {hallazgos.length}
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Severidad</TableHead>
              <TableHead className="w-[130px]">Expediente</TableHead>
              <TableHead className="w-[160px]">Regla</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="w-[110px]">Estado</TableHead>
              <TableHead className="w-[100px]">ETA</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  Sin hallazgos que coincidan con los filtros.
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((h, i) => {
                const sev = severidadConfig[h.severidad];
                return (
                  <TableRow
                    key={`${h.embarque_id}-${h.regla}-${start + i}`}
                    className={cn(i % 2 === 1 && "bg-muted/30")}
                  >
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]", sev.className)}>
                        {sev.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium tabular-nums text-xs">
                      {h.expediente}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {reglaLabel[h.regla]}
                    </TableCell>
                    <TableCell className="truncate max-w-[180px] text-xs" title={h.cliente_nombre}>
                      {h.cliente_nombre || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{h.estado}</TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {formatEta(h.eta)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{h.detalle}</div>
                      {h.documentos_faltantes && h.documentos_faltantes.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {h.documentos_faltantes.map((doc) => (
                            <Badge
                              key={doc}
                              variant="secondary"
                              className="text-[10px] font-normal"
                            >
                              {doc}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => navigate(`/embarques/${h.embarque_id}`)}
                        aria-label="Abrir embarque"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Por página:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[80px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground tabular-nums">
            {filtrados.length === 0
              ? "0 - 0"
              : `${start + 1} - ${Math.min(start + pageSize, filtrados.length)}`}{" "}
            de {filtrados.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={currentPage <= 1}
            onClick={() => setPage(1)}
          >
            «
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </Button>
          <span className="tabular-nums px-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Siguiente
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(totalPages)}
          >
            »
          </Button>
        </div>
      </div>
    </div>
  );
}
