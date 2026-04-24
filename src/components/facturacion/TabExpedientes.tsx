import { useState, useMemo } from "react";
import { FileText, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { formatCurrency } from "@/lib/formatters";
import {
  useExpedientesConsolidados,
  type ExpedienteConsolidado,
  type EstadoProformaExpediente,
} from "@/hooks/embarque/useExpedientesConsolidados";
import { DialogProformaConsolidada } from "./DialogProformaConsolidada";
import { useNavigate } from "react-router-dom";

const DEFAULT_PAGE_SIZE = 20;
type FiltroEstado = "todos" | EstadoProformaExpediente;

const estadoLabels: Record<EstadoProformaExpediente, { label: string; cls: string }> = {
  sin_proforma: { label: "Sin proforma", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  parcial: { label: "Parcial", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  completa: { label: "Completa", cls: "bg-green-100 text-green-800 border-green-200" },
};

export function TabExpedientes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expedienteSel, setExpedienteSel] = useState<ExpedienteConsolidado | null>(null);

  const { data: expedientes = [], isLoading } = useExpedientesConsolidados();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expedientes.filter(e => {
      if (filtroEstado !== "todos" && e.estadoProforma !== filtroEstado) return false;
      if (!q) return true;
      return (
        e.expediente.toLowerCase().includes(q) ||
        (e.bl_master ?? "").toLowerCase().includes(q) ||
        e.cliente_nombre.toLowerCase().includes(q)
      );
    });
  }, [expedientes, search, filtroEstado]);

  const counts = useMemo(() => ({
    todos: expedientes.length,
    sin_proforma: expedientes.filter(e => e.estadoProforma === 'sin_proforma').length,
    parcial: expedientes.filter(e => e.estadoProforma === 'parcial').length,
    completa: expedientes.filter(e => e.estadoProforma === 'completa').length,
  }), [expedientes]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const columns: DataTableColumn<ExpedienteConsolidado>[] = [
    {
      key: "expediente", header: "Expediente", width: "w-[140px]", className: "font-medium",
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
      key: "contenedores", header: "Contenedores", width: "w-[130px]",
      sortable: true, sortValue: (e) => e.contenedoresCount,
      render: (e) => (
        <span className="text-sm">
          {e.contenedoresCount} {e.contenedoresCount === 1 ? 'contenedor' : 'contenedores'}
        </span>
      ),
    },
    {
      key: "pendiente_usd", header: "Pendiente USD", width: "w-[130px]", className: "text-right",
      sortable: true, sortValue: (e) => e.totalPendienteUSD,
      render: (e) => e.totalPendienteUSD > 0 ? formatCurrency(e.totalPendienteUSD, 'USD') : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "pendiente_mxn", header: "Pendiente MXN", width: "w-[130px]", className: "text-right",
      sortable: true, sortValue: (e) => e.totalPendienteMXN,
      render: (e) => e.totalPendienteMXN > 0 ? formatCurrency(e.totalPendienteMXN, 'MXN') : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "estado", header: "Estado Proforma", width: "w-[140px]",
      sortable: true, sortValue: (e) => e.estadoProforma,
      render: (e) => {
        const { label, cls } = estadoLabels[e.estadoProforma];
        return <Badge className={cls + ' hover:' + cls.split(' ')[0]}>{label}</Badge>;
      },
    },
    {
      key: "acciones", header: "Acciones", width: "w-[230px]",
      render: (e) => {
        const sinPendientes = e.estadoProforma === 'completa' || (e.totalPendienteUSD === 0 && e.totalPendienteMXN === 0);
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm"
              onClick={(ev) => { ev.stopPropagation(); navigate(`/embarques/${e.embarques[0].id}`); }}
              title="Ver primer embarque del expediente"
            >
              <Eye className="h-3.5 w-3.5 mr-1" /> Ver
            </Button>
            <Button
              variant="default" size="sm"
              disabled={sinPendientes}
              onClick={(ev) => { ev.stopPropagation(); setExpedienteSel(e); }}
              title={sinPendientes ? 'Sin conceptos pendientes' : 'Generar proforma consolidada'}
            >
              <FileText className="h-3.5 w-3.5 mr-1" /> Generar Proforma
            </Button>
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
          <Tabs value={filtroEstado} onValueChange={(v) => { setFiltroEstado(v as FiltroEstado); setPage(0); }}>
            <TabsList>
              <TabsTrigger value="todos">Todos ({counts.todos})</TabsTrigger>
              <TabsTrigger value="sin_proforma">Sin proforma ({counts.sin_proforma})</TabsTrigger>
              <TabsTrigger value="parcial">Parcial ({counts.parcial})</TabsTrigger>
              <TabsTrigger value="completa">Completa ({counts.completa})</TabsTrigger>
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

      <DialogProformaConsolidada
        open={!!expedienteSel}
        onOpenChange={(o) => !o && setExpedienteSel(null)}
        expediente={expedienteSel}
      />
    </div>
  );
}
