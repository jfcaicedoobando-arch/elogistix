import { AlertTriangle, Anchor, Ship } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, BarChart, Bar, XAxis, LabelList } from "recharts";
import { useNavigate } from "react-router-dom";
import type { NivelRiesgo, CargaRiesgo } from "@/hooks/useOperacionesData";

// ─── Risk indicator chips ────────────────────────────────
export function RiesgoIndicador({ criticos, enPuerto, porArribar }: { criticos: number; enPuerto: number; porArribar: number }) {
  const total = criticos + enPuerto + porArribar;
  if (total === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">
        ✓ Sin riesgo
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {criticos > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-600 text-white">
          <AlertTriangle className="h-3 w-3" />
          {criticos} crítica{criticos > 1 ? "s" : ""}
        </span>
      )}
      {enPuerto > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-amber-400 bg-amber-50 text-amber-700">
          <Anchor className="h-3 w-3" />
          {enPuerto} en puerto
        </span>
      )}
      {porArribar > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-sky-300 bg-sky-50 text-sky-700">
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
  const colorClass = pct > 80 ? "[&>div]:bg-red-500" : pct > 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <Progress value={pct} className={`h-2 w-20 ${colorClass}`} />
      <span className="text-[11px] text-muted-foreground font-medium">{count}</span>
    </div>
  );
}

// ─── Risk badge ──────────────────────────────────────────
const RISK_BADGE_CONFIG: Record<NivelRiesgo, { icon: React.ElementType; className: string; label: string }> = {
  critico:     { icon: AlertTriangle, className: "bg-red-600 text-white", label: "Crítico" },
  en_puerto:   { icon: Anchor, className: "border border-amber-400 bg-amber-50 text-amber-700", label: "En Puerto" },
  por_arribar: { icon: Ship, className: "border border-sky-300 bg-sky-50 text-sky-700", label: "Por Arribar" },
  ok:          { icon: Ship, className: "bg-emerald-100 text-emerald-700", label: "OK" },
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
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Expediente</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-center">Días</TableHead>
            <TableHead>Nivel</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargas.map((c) => (
            <TableRow
              key={c.id}
              className="cursor-pointer hover:bg-muted/30"
              onClick={() => navigate(`/embarques/${c.id}`)}
            >
              <TableCell className="font-mono text-xs">{c.expediente}</TableCell>
              <TableCell className="text-xs">{c.cliente_nombre}</TableCell>
              <TableCell className="text-xs">{c.estadoReal}</TableCell>
              <TableCell className="text-center text-xs font-medium">{c.diasEnPuerto}</TableCell>
              <TableCell><RiskBadge nivel={c.nivelRiesgo} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
