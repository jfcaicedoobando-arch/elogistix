/**
 * Columnas de la tabla de `/admin/diagnostico`.
 */
import { Badge } from "@/components/ui/badge";
import type { DataTableColumn } from "@/components/shared/DataTable";
import type { AppLogRow } from "@/hooks/admin";

const levelVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  warn: "outline",
  error: "destructive",
};

const levelLabel: Record<string, string> = {
  info: "Info",
  warn: "Warn",
  error: "Error",
};

function fmtTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

export const diagnosticoColumns: DataTableColumn<AppLogRow>[] = [
  {
    key: "ts",
    header: "Fecha",
    width: "180px",
    render: (r) => <span className="text-xs tabular-nums">{fmtTs(r.ts)}</span>,
  },
  {
    key: "level",
    header: "Nivel",
    width: "90px",
    render: (r) => (
      <Badge variant={levelVariant[r.level] ?? "secondary"} className="text-[10px]">
        {levelLabel[r.level] ?? r.level}
      </Badge>
    ),
  },
  {
    key: "fn",
    header: "Función",
    width: "160px",
    render: (r) => <span className="font-mono text-xs">{r.fn}</span>,
  },
  {
    key: "status_code",
    header: "Status",
    width: "70px",
    align: "right",
    render: (r) => (
      <span className="font-mono text-xs tabular-nums">
        {r.status_code ?? "—"}
      </span>
    ),
  },
  {
    key: "latency_ms",
    header: "ms",
    width: "70px",
    align: "right",
    render: (r) => (
      <span className="font-mono text-xs tabular-nums">
        {r.latency_ms != null ? r.latency_ms : "—"}
      </span>
    ),
  },
  {
    key: "msg",
    header: "Mensaje",
    render: (r) => (
      <div className="max-w-xl">
        <p className="text-sm">{r.msg}</p>
        {r.payload != null && (
          <details className="mt-1">
            <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
              payload
            </summary>
            <pre className="mt-1 text-[10px] bg-muted rounded p-2 overflow-x-auto max-h-40">
              {JSON.stringify(r.payload, null, 2)}
            </pre>
          </details>
        )}
      </div>
    ),
  },
  {
    key: "request_id",
    header: "Request",
    width: "120px",
    render: (r) => (
      <span className="font-mono text-[10px] text-muted-foreground">
        {r.request_id ? r.request_id.slice(0, 8) : "—"}
      </span>
    ),
  },
];
