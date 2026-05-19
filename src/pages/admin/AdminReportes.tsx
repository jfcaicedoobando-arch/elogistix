import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquarePlus, Bug, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/shared/useDebounce";
import { useReportesFeedback } from "@/hooks/admin/useReportesFeedback";
import {
  ESTADO_FEEDBACK_LABEL,
  TIPO_FEEDBACK_LABEL,
  type EstadoReporteFeedback,
  type ReporteFeedback,
  type TipoReporteFeedback,
} from "@/types/feedback";
import { format } from "date-fns";

const ESTADO_VARIANT: Record<EstadoReporteFeedback, "default" | "secondary" | "outline" | "destructive"> = {
  nuevo: "default",
  en_revision: "secondary",
  resuelto: "outline",
  descartado: "destructive",
};

export default function AdminReportes() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<TipoReporteFeedback | "todos">("todos");
  const [estado, setEstado] = useState<EstadoReporteFeedback | "todos">("todos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useReportesFeedback({
    tipo, estado, search: debouncedSearch, page, pageSize,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: DataTableColumn<ReporteFeedback>[] = [
    {
      key: "tipo", header: "Tipo", width: "100px",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-xs">
          {r.tipo === "bug" ? <Bug className="h-3.5 w-3.5 text-destructive" /> : <Lightbulb className="h-3.5 w-3.5 text-primary" />}
          {TIPO_FEEDBACK_LABEL[r.tipo]}
        </span>
      ),
    },
    { key: "titulo", header: "Título", render: (r) => <span className="font-medium truncate block max-w-[400px]">{r.titulo}</span> },
    { key: "usuario", header: "Usuario", render: (r) => <span className="text-xs">{r.usuario_email}</span> },
    { key: "rol", header: "Rol", render: (r) => <span className="text-xs text-muted-foreground">{r.rol_reportero ?? "—"}</span> },
    {
      key: "estado", header: "Estado", width: "120px",
      render: (r) => <Badge variant={ESTADO_VARIANT[r.estado]} className="text-[10px]">{ESTADO_FEEDBACK_LABEL[r.estado]}</Badge>,
    },
    {
      key: "fecha", header: "Fecha", width: "140px",
      render: (r) => <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<MessageSquarePlus className="h-6 w-6 text-primary" />}
        title="Reportes de usuarios"
        description={`${total} reporte(s) en total. Gestiona los bugs y mejoras enviados desde la app.`}
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por título, descripción o usuario..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <Select value={tipo} onValueChange={(v) => { setTipo(v as typeof tipo); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="bug">Bugs</SelectItem>
            <SelectItem value="mejora">Mejoras</SelectItem>
          </SelectContent>
        </Select>
        <Select value={estado} onValueChange={(v) => { setEstado(v as typeof estado); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="nuevo">Nuevo</SelectItem>
            <SelectItem value="en_revision">En revisión</SelectItem>
            <SelectItem value="resuelto">Resuelto</SelectItem>
            <SelectItem value="descartado">Descartado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No hay reportes con los filtros aplicados."
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/admin/reportes/${r.id}`)}
          density="comfortable"
          pagination={{
            page, totalPages,
            onPageChange: setPage,
            pageSize,
          }}
        />
      </div>
    </div>
  );
}
