import { useState } from "react";
import { Repeat2, RefreshCw, Copy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useToast } from "@/hooks/use-toast";

interface IdemRow {
  key: string;
  fn: string;
  hits: number;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  has_response: boolean;
  pending: boolean;
}

type FnFilter = "todos" | "crear_embarque_completo" | "duplicar_embarque_completo" | "consolidar_proformas" | "marcar_proforma_facturada" | "actualizar_embarque_completo" | "avanzar_estado_embarque" | "actualizar_cotizacion_costos";

const FN_LABEL: Record<string, string> = {
  crear_embarque_completo: "Crear embarque",
  duplicar_embarque_completo: "Duplicar embarque",
  consolidar_proformas: "Consolidar proformas",
  marcar_proforma_facturada: "Marcar facturada",
  actualizar_embarque_completo: "Editar embarque",
  avanzar_estado_embarque: "Avanzar estado",
  actualizar_cotizacion_costos: "Editar costos cotización",
};

const FN_OPTIONS: { value: FnFilter; label: string }[] = [
  { value: "todos", label: "Todas las operaciones" },
  { value: "crear_embarque_completo", label: FN_LABEL.crear_embarque_completo },
  { value: "duplicar_embarque_completo", label: FN_LABEL.duplicar_embarque_completo },
  { value: "actualizar_embarque_completo", label: FN_LABEL.actualizar_embarque_completo },
  { value: "avanzar_estado_embarque", label: FN_LABEL.avanzar_estado_embarque },
  { value: "actualizar_cotizacion_costos", label: FN_LABEL.actualizar_cotizacion_costos },
  { value: "consolidar_proformas", label: FN_LABEL.consolidar_proformas },
  { value: "marcar_proforma_facturada", label: FN_LABEL.marcar_proforma_facturada },
];

const dtf = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

export default function Idempotencia() {
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const [filtroFn, setFiltroFn] = useState<FnFilter>("todos");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["idempotencia-log"],
    queryFn: async (): Promise<IdemRow[]> => {
      const { data, error } = await supabase.rpc("list_idempotency_log", { _limit: 200, _offset: 0 });
      if (error) throw error;
      return (data ?? []) as IdemRow[];
    },
    enabled: isAdmin,
  });

  if (!isAdmin) return <Navigate to="/" replace />;

  const rows = (data ?? []).filter((r) => filtroFn === "todos" || r.fn === filtroFn);

  const copyKey = async (k: string) => {
    try {
      await navigator.clipboard.writeText(k);
      toast({ title: "requestId copiado" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  const columns: DataTableColumn<IdemRow>[] = [
    {
      key: "created_at",
      header: "Fecha",
      render: (r) => <span className="text-sm tabular-nums">{dtf.format(new Date(r.created_at))}</span>,
    },
    {
      key: "fn",
      header: "Operación",
      render: (r) => <span className="text-sm">{FN_LABEL[r.fn] ?? r.fn}</span>,
    },
    {
      key: "key",
      header: "requestId",
      render: (r) => (
        <div className="flex items-center gap-1">
          <code className="text-xs font-mono text-muted-foreground">{r.key.slice(0, 8)}…{r.key.slice(-4)}</code>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyKey(r.key)} title="Copiar requestId completo">
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
    {
      key: "user_email",
      header: "Usuario",
      render: (r) => <span className="text-sm text-muted-foreground">{r.user_email ?? (r.user_id ? r.user_id.slice(0, 8) : "—")}</span>,
    },
    {
      key: "hits",
      header: "Reintentos",
      align: "right",
      render: (r) => (
        <span className={`text-sm tabular-nums ${r.hits > 0 ? "font-semibold text-amber-600" : "text-muted-foreground"}`}>
          {r.hits}
        </span>
      ),
    },
    {
      key: "result",
      header: "Resultado",
      render: (r) => {
        if (r.pending) return <Badge variant="outline">Pendiente</Badge>;
        if (r.hits === 0) return <Badge variant="success">Creado</Badge>;
        return <Badge variant="warning">Respuesta cacheada</Badge>;
      },
    },
  ];

  const totalCreados = rows.filter((r) => !r.pending && r.hits === 0).length;
  const totalCacheados = rows.filter((r) => !r.pending && r.hits > 0).length;
  const totalDuplicadosBloqueados = rows.reduce((s, r) => s + r.hits, 0);

  return (
    <div className="space-y-6">
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
          <div className="text-2xl font-semibold tabular-nums">{totalCreados}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Respuestas cacheadas</div>
          <div className="text-2xl font-semibold tabular-nums">{totalCacheados}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Duplicados bloqueados</div>
          <div className="text-2xl font-semibold tabular-nums">{totalDuplicadosBloqueados}</div>
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
    </div>
  );
}
