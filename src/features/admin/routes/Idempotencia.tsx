import { Repeat2, RefreshCw, Copy } from "lucide-react";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { usePermissions, useToast } from "@/hooks/shared";
import { useIdempotenciaLog, type FnFilter } from "@/features/admin/hooks";
import type { IdempotenciaRow } from "@/features/admin/services";

import { notifyError } from "@/lib/ui/appFeedback";
const FN_LABEL: Record<string, string> = {
  crear_embarque_completo: "Crear embarque",
  duplicar_embarque_completo: "Duplicar embarque",
  consolidar_proformas: "Consolidar proformas",
  marcar_proforma_facturada: "Marcar facturada",
  actualizar_embarque_completo: "Editar embarque",
  avanzar_estado_embarque: "Avanzar estado",
  actualizar_cotizacion_costos: "Editar costos cotización",
  upload_documento_embarque: "Subir documento",
};

const FN_OPTIONS: { value: FnFilter; label: string }[] = [
  { value: "todos", label: "Todas las operaciones" },
  { value: "crear_embarque_completo", label: FN_LABEL.crear_embarque_completo },
  { value: "duplicar_embarque_completo", label: FN_LABEL.duplicar_embarque_completo },
  { value: "actualizar_embarque_completo", label: FN_LABEL.actualizar_embarque_completo },
  { value: "avanzar_estado_embarque", label: FN_LABEL.avanzar_estado_embarque },
  { value: "actualizar_cotizacion_costos", label: FN_LABEL.actualizar_cotizacion_costos },
  { value: "upload_documento_embarque", label: FN_LABEL.upload_documento_embarque },
  { value: "consolidar_proformas", label: FN_LABEL.consolidar_proformas },
  { value: "marcar_proforma_facturada", label: FN_LABEL.marcar_proforma_facturada },
];

import { formatFechaHora } from "@/lib/formatters";
const dtf = {
  format(d: Date): string {
    return formatFechaHora(d.toISOString(), {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  },
};

export default function Idempotencia() {
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const { filtroFn, setFiltroFn, rows, isLoading, isFetching, refetch, totales } =
    useIdempotenciaLog(isAdmin);

  if (!isAdmin) return <Navigate to="/" replace />;

  const copyKey = async (k: string) => {
    try {
      await navigator.clipboard.writeText(k);
      toast({ title: "requestId copiado" });
    } catch {
      notifyError(toast, { title: "No se pudo copiar", method: "PAGES_ADMIN_IDEMPOTENCIA_1" });
    }
  };

  const columns: ColumnDef<IdempotenciaRow, unknown>[] = defineColumns<IdempotenciaRow>([
    {
      id: "created_at",
      header: "Fecha",
      cell: ({ row }) => <span className="text-sm tabular-nums">{dtf.format(new Date(row.original.created_at))}</span>,
    },
    {
      id: "fn",
      header: "Operación",
      cell: ({ row }) => <span className="text-sm">{FN_LABEL[row.original.fn] ?? row.original.fn}</span>,
    },
    {
      id: "key",
      header: "requestId",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-1">
            <code className="text-xs font-mono text-muted-foreground">{r.key.slice(0, 8)}…{r.key.slice(-4)}</code>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyKey(r.key)} title="Copiar requestId completo">
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        );
      },
    },
    {
      id: "user_email",
      header: "Usuario",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.user_email ?? (row.original.user_id ? row.original.user_id.slice(0, 8) : "—")}</span>,
    },
    {
      id: "hits",
      header: "Reintentos",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className={`text-sm tabular-nums ${row.original.hits > 0 ? "font-semibold text-warning" : "text-muted-foreground"}`}>
          {row.original.hits}
        </span>
      ),
    },
    {
      id: "result",
      header: "Resultado",
      cell: ({ row }) => {
        const r = row.original;
        if (r.pending) return <Badge variant="outline">Pendiente</Badge>;
        if (r.hits === 0) return <Badge variant="success">Creado</Badge>;
        return <Badge variant="warning">Respuesta cacheada</Badge>;
      },
    },
  ]);

  return (
    <PageContainer>
      <PageHeader
        icon={<Repeat2 className="h-6 w-6" />}
        title="Idempotencia"
        description="Auditoría de mutaciones críticas: requestId, operación y resultado (creado vs respuesta cacheada)."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Recargar
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Registros creados</div>
          <div className="text-2xl font-semibold tabular-nums">{totales.totalCreados}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Respuestas cacheadas</div>
          <div className="text-2xl font-semibold tabular-nums">{totales.totalCacheados}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Duplicados bloqueados</div>
          <div className="text-2xl font-semibold tabular-nums">{totales.totalDuplicadosBloqueados}</div>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filtroFn} onValueChange={(v) => setFiltroFn(v as FnFilter)}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {rows.length} {rows.length === 1 ? "registro" : "registros"}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            rowKey={(r) => r.key}
            emptyMessage="Sin claves de idempotencia recientes"
            density="comfortable"
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
