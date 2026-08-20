/**
 * Columnas de la tabla de `/admin/diagnostico`.
 */
import { Badge } from "@/components/ui/badge";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatFechaHora } from "@/lib/formatters";
import type { AppLogRow } from "@/features/admin/hooks";


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
  return formatFechaHora(ts, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}


export const diagnosticoColumns: ColumnDef<AppLogRow, unknown>[] = defineColumns<AppLogRow>([
  {
    id: "ts",
    header: "Fecha",
    meta: { width: "180px" },
    cell: ({ row }) => <span className="text-body-sm tabular-nums">{fmtTs(row.original.ts)}</span>,
  },
  {
    id: "level",
    header: "Nivel",
    meta: { width: "90px" },
    cell: ({ row }) => (
      <Badge variant={levelVariant[row.original.level] ?? "secondary"} className="text-label">
        {levelLabel[row.original.level] ?? row.original.level}
      </Badge>
    ),
  },
  {
    id: "fn",
    header: "Función",
    meta: { width: "160px" },
    cell: ({ row }) => <span className="font-mono text-body-sm">{row.original.fn}</span>,
  },
  {
    id: "status_code",
    header: "Status",
    meta: { width: "70px", align: "right" },
    cell: ({ row }) => (
      <span className="font-mono text-body-sm tabular-nums">
        {row.original.status_code ?? "—"}
      </span>
    ),
  },
  {
    id: "latency_ms",
    header: "ms",
    meta: { width: "70px", align: "right" },
    cell: ({ row }) => (
      <span className="font-mono text-body-sm tabular-nums">
        {row.original.latency_ms != null ? row.original.latency_ms : "—"}
      </span>
    ),
  },
  {
    id: "msg",
    header: "Mensaje",
    cell: ({ row }) => {
      const r = row.original;
      return (
        <div className="max-w-xl">
          <p className="text-body">{r.msg}</p>
          {r.payload != null && (
            <details className="mt-1">
              <summary className="text-label text-muted-foreground cursor-pointer hover:text-foreground">
                payload
              </summary>
              <pre className="mt-1 text-label bg-muted rounded p-2 overflow-x-auto max-h-40">
                {JSON.stringify(r.payload, null, 2)}
              </pre>
            </details>
          )}
        </div>
      );
    },
  },
  {
    id: "request_id",
    header: "Request",
    meta: { width: "120px" },
    cell: ({ row }) => (
      <span className="font-mono text-label text-muted-foreground">
        {row.original.request_id ? row.original.request_id.slice(0, 8) : "—"}
      </span>
    ),
  },
]);
