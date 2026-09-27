import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MONTO_MAX } from "@/lib/validation/limitesNumericos";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { calcularMargen, calcularUtilidad } from "@/lib/financial/financialUtils";
import { ProfitBadge } from "./ProfitBadge";

interface Fila { concepto: string; proveedor: string; cantidad: number; costo_unitario: number; venta: number; notas?: string }

export function CostosCotizacionMobile({ filas, moneda, canEdit, onUpdate }: {
  filas: Fila[]; moneda: "USD" | "MXN"; canEdit: boolean;
  onUpdate: (index: number, field: "proveedor" | "costo_unitario" | "venta" | "notas", value: string) => void;
}) {
  return <ul aria-label={`Costos móviles en ${moneda}`} className="divide-y rounded-md border md:hidden">{filas.map((f, i) => {
    const costo = f.cantidad * f.costo_unitario;
    const utilidad = calcularUtilidad(f.venta, costo);
    return <li key={`${f.concepto}-${i}`} className="space-y-2 p-3">
      <p className="font-medium text-body break-words">{f.concepto}</p>
      {canEdit ? <label className="block text-body-sm">Proveedor<Input value={f.proveedor} onChange={(e) => onUpdate(i, "proveedor", e.target.value)} aria-label={`Proveedor de ${f.concepto}`} /></label> : <p className="text-body-sm text-muted-foreground">Proveedor: {f.proveedor || "Sin proveedor"}</p>}
      <p className="text-body-sm text-muted-foreground">Cantidad: <span className="tabular-nums">{formatNumber(f.cantidad)}</span></p>
      <div className="grid grid-cols-2 gap-3 text-body-sm">
        <div><span className="text-label text-muted-foreground">Costo unitario</span>
          {canEdit ? <Input type="number" value={f.costo_unitario || ""} onChange={(e) => onUpdate(i, "costo_unitario", e.target.value)} min={0} max={MONTO_MAX} step={0.01} className="tabular-nums" aria-label={`Costo unitario de ${f.concepto}`} /> : <p className="tabular-nums">{formatCurrency(f.costo_unitario, moneda)}</p>}
        </div>
        <div><span className="text-label text-muted-foreground">Venta total</span>
          {canEdit ? <Input type="number" value={f.venta || ""} onChange={(e) => onUpdate(i, "venta", e.target.value)} min={0} max={MONTO_MAX} step={0.01} className="tabular-nums" aria-label={`Venta total de ${f.concepto}`} /> : <p className="tabular-nums">{formatCurrency(f.venta, moneda)}</p>}
        </div>
        <div><span className="text-label text-muted-foreground">Costo total</span><p className="tabular-nums">{formatCurrency(costo, moneda)}</p></div>
        <div><span className="text-label text-muted-foreground">Utilidad</span><p className="tabular-nums">{formatCurrency(utilidad, moneda)}</p></div>
      </div>
      {canEdit ? <label className="block text-body-sm">Notas (opcional)<Textarea value={f.notas || ""} onChange={(e) => onUpdate(i, "notas", e.target.value)} aria-label={`Notas de ${f.concepto}`} className="min-h-16 resize-y" /></label> : f.notas && <p className="text-body-sm text-muted-foreground break-words">{f.notas}</p>}
      <ProfitBadge porcentaje={calcularMargen(f.venta, costo)} venta={f.venta} />
    </li>;
  })}</ul>;
}
