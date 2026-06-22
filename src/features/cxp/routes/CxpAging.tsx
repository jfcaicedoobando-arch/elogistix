/**
 * Página de Antigüedad de Saldos (aging) de CxP.
 * Ruta: `/compras/aging`. Tabla por proveedor + 5 KPIs por cubeta.
 */
import { useMemo } from "react";
import { LayoutList, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { ComprasTabStrip } from "@/features/cxp/components/ComprasTabStrip";
import { buildCxpAgingColumns } from "@/features/cxp/components/cxpAgingColumns";
import { useCxpAging } from "@/features/cxp/hooks/useCxpAging";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

function KpiBucket({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warn" | "danger" }) {
  const toneCls =
    tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-xl font-semibold tabular-nums mt-1", toneCls)}>
          {formatCurrency(value, "MXN")}
        </p>
      </CardContent>
    </Card>
  );
}

function exportarCsv(rows: ReturnType<typeof useCxpAging>["data"]) {
  if (!rows || rows.length === 0) return;
  const headers = ["Proveedor", "Facturas", "Vigente", "1-30", "31-60", "61-90", ">90", "Total"];
  const lines = rows.map((r) =>
    [
      `"${r.proveedor_nombre.replace(/"/g, '""')}"`,
      r.num_facturas, r.vigente, r.d_1_30, r.d_31_60, r.d_61_90, r.mas_90, r.saldo_total,
    ].join(","),
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aging-cxp-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CxpAging() {
  const { data = [], isLoading, totales } = useCxpAging();
  const columns = useMemo(() => buildCxpAgingColumns(), []);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<LayoutList className="h-6 w-6 text-accent" />}
        title="Antigüedad de Saldos"
        description="Saldos por proveedor agrupados por días de vencimiento (MXN)."
        actions={
          <Button variant="outline" size="sm" onClick={() => exportarCsv(data)} disabled={data.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        }
      />

      <ComprasTabStrip />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <KpiBucket label="Vigente" value={totales.vigente} />
        <KpiBucket label="1-30 días" value={totales.d_1_30} tone={totales.d_1_30 > 0 ? "warn" : "default"} />
        <KpiBucket label="31-60 días" value={totales.d_31_60} tone={totales.d_31_60 > 0 ? "warn" : "default"} />
        <KpiBucket label="61-90 días" value={totales.d_61_90} tone={totales.d_61_90 > 0 ? "danger" : "default"} />
        <KpiBucket label=">90 días" value={totales.mas_90} tone={totales.mas_90 > 0 ? "danger" : "default"} />
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={data}
            isLoading={isLoading}
            rowKey={(r) => r.proveedor_id}
            emptyMessage="Sin saldos pendientes"
            emptyHint="No hay facturas de proveedor con saldo abierto."
            striped
            hoverable
            density="compact"
          />
        </CardContent>
      </Card>
    </div>
  );
}
