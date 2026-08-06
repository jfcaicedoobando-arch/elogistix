/**
 * Resumen de los datos heredados de la cotización vinculada que se
 * persistirán en el embarque pero todavía no tienen UI de edición
 * dedicada en el wizard (Pack B+ v13.33.0).
 *
 * Aparece solo cuando hay cotización vinculada y la cotización trae al menos
 * uno de estos campos definidos. Es read-only: el caller puede editar los
 * valores desde la cotización origen y vincular de nuevo.
 */
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2 } from "lucide-react";
import { useCotizacionVinculada } from "@/features/embarques/hooks/useCotizacionVinculada";
import type { CotizacionRow } from "@/features/cotizacion/hooks";
import { formatCurrency } from "@/lib/formatters/numbers";

// ── Row ────────────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

function hasInheritedData(cot: CotizacionRow): boolean {
  return !!(
    cot.tarifa_id ||
    cot.carta_garantia ||
    (cot.dias_libres_destino ?? 0) > 0 ||
    (cot.dias_almacenaje ?? 0) > 0 ||
    cot.seguro ||
    cot.notas
  );
}

type RowData = { label: string; value: ReactNode };

function computeResumenRows(cot: CotizacionRow): RowData[] {
  const rows: RowData[] = [];

  if (cot.tarifa_id) {
    rows.push({ label: "Tarifa marítima vinculada", value: "Sí" });
  }
  if (cot.carta_garantia) {
    rows.push({ label: "Carta garantía requerida", value: "Sí" });
  }
  if ((cot.dias_libres_destino ?? 0) > 0) {
    rows.push({ label: "Días libres demoras", value: `${cot.dias_libres_destino} días` });
  }
  if ((cot.dias_almacenaje ?? 0) > 0) {
    rows.push({ label: "Días libres almacenaje", value: `${cot.dias_almacenaje} días` });
  }
  if (cot.seguro) {
    const seguroValue = cot.valor_seguro_usd
      ? formatCurrency(Number(cot.valor_seguro_usd), "USD")
      : "Sí";
    rows.push({ label: "Seguro", value: seguroValue });
  }
  if (cot.notas) {
    rows.push({
      label: "Notas",
      value: <span className="text-xs italic max-w-[60%]">{cot.notas}</span>,
    });
  }

  return rows;
}

// ── ResumenHerenciaCotizacion ──────────────────────────────────────────────────

export function ResumenHerenciaCotizacion() {
  const cot = useCotizacionVinculada();
  if (!cot) return null;
  if (!hasInheritedData(cot)) return null;

  const rows = computeResumenRows(cot);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Datos heredados de cotización
          <Badge variant="secondary" className="ml-auto text-2xs">{cot.folio ?? ""}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.map((r) => (
          <Row key={r.label} label={r.label} value={r.value} />
        ))}
        <p className="text-label text-muted-foreground mt-3">
          Estos campos se guardarán automáticamente con el embarque al crearlo.
        </p>
      </CardContent>
    </Card>
  );
}
