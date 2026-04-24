import { useState, useMemo } from "react";
import { CheckCircle2, Layers, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { formatCurrency } from "@/lib/formatters";
import {
  useExpedientesConsolidados,
  type ExpedienteConsolidado,
} from "@/hooks/embarque/useExpedientesConsolidados";
import { useAprobarProforma } from "@/hooks/embarque/useProformas";
import { DialogConsolidarAprobar } from "./DialogConsolidarAprobar";
import { useNavigate } from "react-router-dom";

const DEFAULT_PAGE_SIZE = 20;
type FiltroEstado = "todos" | "con_borrador" | "sin_borrador";

export function TabExpedientes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<FiltroEstado>("con_borrador");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expedienteParaConsolidar, setExpedienteParaConsolidar] = useState<ExpedienteConsolidado | null>(null);
  const [aprobacionPendiente, setAprobacionPendiente] = useState<{ proformaId: string; numero: string } | null>(null);

  const { data: expedientes = [], isLoading } = useExpedientesConsolidados();
  const aprobar = useAprobarProforma();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expedientes.filter(e => {
      if (filtro === "con_borrador" && e.proformasBorrador.length === 0) return false;
      if (filtro === "sin_borrador" && e.proformasBorrador.length > 0) return false;
      if (!q) return true;
      return (
        e.expediente.toLowerCase().includes(q) ||
        (e.bl_master ?? "").toLowerCase().includes(q) ||
        e.cliente_nombre.toLowerCase().includes(q)
      );
    });
  }, [expedientes, search, filtro]);

  const counts = useMemo(() => ({
    todos: expedientes.length,
    con_borrador: expedientes.filter(e => e.proformasBorrador.length > 0).length,
    sin_borrador: expedientes.filter(e => e.proformasBorrador.length === 0).length,
  }), [expedientes]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const handleAprobar = () => {
    if (!aprobacionPendiente) return;
    aprobar.mutate(aprobacionPendiente, {
      onSuccess: () => setAprobacionPendiente(null),
    });
  };

  const columns: DataTableColumn<ExpedienteConsolidado>[] = [
    {
      key: "expediente", header: "Expediente", width: "w-[130px]", className: "font-medium",
      sticky: true, sortable: true, sortValue: (e) => e.expediente, render: (e) => e.expediente,
    },
    {
      key: "bl", header: "BL Master", width: "w-[150px]", className: "text-xs font-mono",
      sortable: true, sortValue: (e) => e.bl_master ?? '',
      render: (e) => e.bl_master || <span className="text-muted-foreground">—</span>,
    },
    {
      key: "cliente", header: "Cliente", width: "min-w-[180px]", className: "max-w-[220px] truncate",
      sortable: true, sortValue: (e) => e.cliente_nombre, render: (e) => e.cliente_nombre,
    },
    {
      key: "contenedores", header: "Contenedores", width: "w-[120px]",
      sortable: true, sortValue: (e) => e.contenedoresCount,
      render: (e) => <span className="text-sm">{e.contenedoresCount}</span>,
    },
    {
      key: "borradores", header: "Proformas Borrador", width: "w-[160px]",
      sortable: true, sortValue: (e) => e.proformasBorrador.length,
      render: (e) => e.proformasBorrador.length === 0
        ? <span className="text-muted-foreground text-sm">—</span>
        : (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
            {e.proformasBorrador.length} en borrador
          </Badge>
        ),
    },
    {
      key: "total_usd", header: "Total USD", width: "w-[120px]", className: "text-right",
      sortable: true, sortValue: (e) => e.totalBorradorUSD,
      render: (e) => e.totalBorradorUSD > 0 ? formatCurrency(e.totalBorradorUSD, 'USD') : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "total_mxn", header: "Total MXN", width: "w-[120px]", className: "text-right",
      sortable: true, sortValue: (e) => e.totalBorradorMXN,
      render: (e) => e.totalBorradorMXN > 0 ? formatCurrency(e.totalBorradorMXN, 'MXN') : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "acciones", header: "Acciones", width: "w-[280px]",
      render: (e) => {
        const cantidad = e.proformasBorrador.length;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm"
              onClick={(ev) => { ev.stopPropagation(); navigate(`/embarques/${e.embarques[0].id}`); }}
              title="Ver primer embarque del expediente"
            >
              <Eye className="h-3.5 w-3.5 mr-1" /> Ver
            </Button>
            {cantidad === 1 && (
              <Button
                variant="default" size="sm"
                onClick={(ev) => {
                  ev.stopPropagation();
                  const p = e.proformasBorrador[0];
                  setAprobacionPendiente({ proformaId: p.id, numero: p.numero });
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprobar
              </Button>
            )}
            {cantidad >= 2 && (
              <Button
                variant="default" size="sm"
                onClick={(ev) => { ev.stopPropagation(); setExpedienteParaConsolidar(e); }}
              >
                <Layers className="h-3.5 w-3.5 mr-1" /> Consolidar y Aprobar
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(0); }}
            placeholder="Buscar por expediente, BL o cliente..."
            className="flex-1 min-w-[240px]"
          />
          <Tabs value={filtro} onValueChange={(v) => { setFiltro(v as FiltroEstado); setPage(0); }}>
            <TabsList>
              <TabsTrigger value="con_borrador">Con borrador ({counts.con_borrador})</TabsTrigger>
              <TabsTrigger value="sin_borrador">Sin borrador ({counts.sin_borrador})</TabsTrigger>
              <TabsTrigger value="todos">Todos ({counts.todos})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paginated}
            isLoading={isLoading}
            emptyMessage="No hay expedientes para mostrar"
            rowKey={(e) => e.key}
          />
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          />
        </CardContent>
      </Card>

      <DialogConsolidarAprobar
        open={!!expedienteParaConsolidar}
        onOpenChange={(o) => !o && setExpedienteParaConsolidar(null)}
        expediente={expedienteParaConsolidar}
      />

      <AlertDialog open={!!aprobacionPendiente} onOpenChange={(o) => !o && setAprobacionPendiente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar proforma?</AlertDialogTitle>
            <AlertDialogDescription>
              La proforma <span className="font-mono">{aprobacionPendiente?.numero}</span> pasará al área de
              Pre-Facturación → Proformas y podrá ser facturada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={aprobar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAprobar} disabled={aprobar.isPending}>
              Aprobar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
