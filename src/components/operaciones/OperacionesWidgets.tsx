import { AlertTriangle, Anchor, Ship } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ResponsiveContainer, BarChart, Bar, XAxis, LabelList } from "recharts";
import { useNavigate } from "react-router-dom";
import { toTitleCase } from "@/lib/formatters";
import type { NivelRiesgo, CargaRiesgo } from "@/hooks/operaciones/useOperacionesData";

// ─── Risk indicator chips ────────────────────────────────
export function RiesgoIndicador({ criticos, enPuerto, porArribar }: { criticos: number; enPuerto: number; porArribar: number }) {
  const total = criticos + enPuerto + porArribar;
  if (total === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/15 text-success">
        ✓ Sin riesgo
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {criticos > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-destructive text-destructive-foreground">
          <AlertTriangle className="h-3 w-3" />
          {criticos} crítica{criticos > 1 ? "s" : ""}
        </span>
      )}
      {enPuerto > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-warning/40 bg-warning/10 text-warning">
          <Anchor className="h-3 w-3" />
          {enPuerto} en puerto
        </span>
      )}
      {porArribar > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-kpi-secondary/40 bg-kpi-secondary-soft text-kpi-secondary">
          <Ship className="h-3 w-3" />
          {porArribar} por arribar
        </span>
      )}
    </div>
  );
}

// ─── Capacity bar ────────────────────────────────────────
export function CapacityBar({ count, max }: { count: number; max: number }) {
  const pct = Math.min((count / max) * 100, 100);
  const colorClass = pct > 80 ? "[&>div]:bg-destructive" : pct > 60 ? "[&>div]:bg-warning" : "[&>div]:bg-success";
  return (
    <div className="flex items-center gap-2">
      <Progress value={pct} className={`h-2 w-20 ${colorClass}`} />
      <span className="text-[11px] text-muted-foreground font-medium">{count}</span>
    </div>
  );
}

// ─── Risk badge ──────────────────────────────────────────
const RISK_BADGE_CONFIG: Record<NivelRiesgo, { icon: React.ElementType; className: string; label: string }> = {
  critico:     { icon: AlertTriangle, className: "bg-destructive text-destructive-foreground", label: "Crítico" },
  en_puerto:   { icon: Anchor, className: "border border-warning/40 bg-warning/10 text-warning", label: "En Puerto" },
  por_arribar: { icon: Ship, className: "border border-kpi-secondary/40 bg-kpi-secondary-soft text-kpi-secondary", label: "Por Arribar" },
  ok:          { icon: Ship, className: "bg-success/15 text-success", label: "OK" },
};

export function RiskBadge({ nivel }: { nivel: NivelRiesgo }) {
  const cfg = RISK_BADGE_CONFIG[nivel];
  const Icono = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.className}`}>
      <Icono className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ─── Mini bar chart ──────────────────────────────────────
export function MiniBarChart({ data }: { data: { mes: string; valor: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
        <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="valor" position="top" className="text-[10px] fill-muted-foreground" />
        </Bar>
        <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Risk detail table ───────────────────────────────────
export function RiskDetailTable({ cargas }: { cargas: CargaRiesgo[] }) {
  const navigate = useNavigate();
  if (cargas.length === 0) return <p className="text-xs text-muted-foreground">Sin cargas en riesgo</p>;

  const cols: DataTableColumn<CargaRiesgo>[] = [
    { key: "exp", header: "Expediente", className: "font-mono text-xs", render: (c) => c.expediente },
    { key: "cliente", header: "Cliente", className: "text-xs", render: (c) => <span title={c.cliente_nombre}>{toTitleCase(c.cliente_nombre)}</span> },
    { key: "estado", header: "Estado", className: "text-xs", render: (c) => c.estadoReal },
    { key: "dias", header: "Días", align: "center", className: "text-xs font-medium", render: (c) => c.diasEnPuerto },
    { key: "nivel", header: "Nivel", render: (c) => <RiskBadge nivel={c.nivelRiesgo} /> },
  ];

  return (
    <div className="rounded-lg border overflow-hidden">
      <DataTable
        columns={cols}
        data={cargas}
        rowKey={(c) => c.id}
        density="compact"
        onRowClick={(c) => navigate(`/embarques/${c.id}`)}
      />
    </div>
  );
}
