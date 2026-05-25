/**
 * /crm/actividades — Lista global de actividades CRM con filtros.
 */
import { useState } from "react";
import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SearchInput from "@/components/selects/SearchInput";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { useDebounce } from "@/hooks/shared";
import {
  useActividades, ACTIVIDAD_TIPOS,
  type CrmActividadRow, type CrmActividadTipo,
} from "@/hooks/crm/useActividades";
import ActividadRowActions from "@/components/crm/ActividadRowActions";
import { usePermissions } from "@/hooks/shared";

const baseColumns: ColumnDef<CrmActividadRow, unknown>[] = defineColumns<CrmActividadRow>([
  { id: "tipo", header: "Tipo", meta: { width: "w-[100px]" }, cell: ({ row }) => <Badge variant="outline">{row.original.tipo}</Badge> },
  { id: "asunto", header: "Asunto", meta: { className: "font-medium" }, cell: ({ row }) => row.original.asunto },
  { id: "entidad", header: "Entidad", meta: { className: "text-xs" }, cell: ({ row }) => row.original.entidad_tipo },
  { id: "responsable", header: "Responsable", meta: { className: "text-xs" }, cell: ({ row }) => row.original.responsable_email || "—" },
  {
    id: "estado", header: "Estado", meta: { width: "w-[110px]" },
    cell: ({ row }) => row.original.fecha_completada
      ? <Badge variant="secondary">Completada</Badge>
      : <Badge>Pendiente</Badge>,
  },
  {
    id: "fecha", header: "Programada", meta: { className: "text-xs" },
    cell: ({ row }) => row.original.fecha_programada ? new Date(row.original.fecha_programada).toLocaleString("es-MX") : "—",
  },
]);

const actionColumn: ColumnDef<CrmActividadRow, unknown> = {
  id: "acciones", header: "", meta: { width: "w-[110px]" },
  cell: ({ row }) => <ActividadRowActions actividad={row.original} />,
};

export default function Actividades() {
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState<CrmActividadTipo | "todos">("todos");
  const [estado, setEstado] = useState<"pendientes" | "completadas" | "todas">("pendientes");
  const [responsable, setResponsable] = useState<"mias" | "todos">("todos");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const debounced = useDebounce(search, 300);

  const { data, isLoading } = useActividades({ search: debounced, tipo, estado, responsable, page, pageSize });
  const items = data?.data ?? [];
  const totalPages = Math.ceil((data?.count ?? 0) / pageSize);

  return (
    <div className="space-y-6 p-6">
      <PageHeader icon={<Activity className="h-6 w-6 text-primary" />} title="Actividades" description={`${data?.count ?? 0} actividades`} />
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por asunto..." />
          <Select value={tipo} onValueChange={(v) => { setTipo(v as typeof tipo); setPage(0); }}>
            <SelectTrigger className="md:w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {ACTIVIDAD_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={estado} onValueChange={(v) => { setEstado(v as typeof estado); setPage(0); }}>
            <SelectTrigger className="md:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendientes">Pendientes</SelectItem>
              <SelectItem value="completadas">Completadas</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={responsable} onValueChange={(v) => { setResponsable(v as typeof responsable); setPage(0); }}>
            <SelectTrigger className="md:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="mias">Mis actividades</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={items}
            isLoading={isLoading}
            emptyMessage="Sin actividades"
            rowKey={(a) => a.id}
            density="comfortable"
            pagination={{
              page, totalPages, pageSize,
              onPageChange: setPage,
              onPageSizeChange: (s) => { setPageSize(s); setPage(0); },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
