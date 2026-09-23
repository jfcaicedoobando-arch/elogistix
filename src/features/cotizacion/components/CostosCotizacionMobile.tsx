import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/formatters";
import { calcularMargen, calcularUtilidad } from "@/lib/financial/financialUtils";
import { ProfitBadge } from "./ProfitBadge";

interface Fila { concepto: string; proveedor: string; cantidad: number; costo_unitario: number; venta: number }

export function CostosCotizacionMobile({ filas, moneda, canEdit, onUpdate }: {
  filas: Fila[]; moneda: "USD" | "MXN"; canEdit: boolean;
  onUpdate: (index: number, field: "proveedor" | "costo_unitario" | "venta", value: string) => void;
}) {
  return <ul aria-label={`Costos móviles en ${moneda}`} className="divide-y rounded-md border md:hidden">{filas.map((f, i) => {
    const costo = f.cantidad * f.costo_unitario;
    const utilidad = calcularUtilidad(f.venta, costo);
    return <li key={`${f.concepto}-${i}`} className="space-y-2 p-3">
      <p className="font-medium text-body break-words">{f.concepto}</p>
      {canEdit ? <Input value={f.proveedor} onChange={(e) => onUpdate(i, "proveedor", e.target.value)} aria-label={`Proveedor de ${f.concepto}`} /> : <p className="text-body-sm text-muted-foreground">Proveedor: {f.proveedor || "Sin proveedor"}</p>}
      <div className="grid grid-cols-3 gap-2 text-body-sm"><div><span className="text-label text-muted-foreground">Costo</span><p className="tabular-nums">{formatCurrency(costo, moneda)}</p></div><div><span className="text-label text-muted-foreground">Venta</span><p className="tabular-nums">{formatCurrency(f.venta, moneda)}</p></div><div><span className="text-label text-muted-foreground">Utilidad</span><p className="tabular-nums">{formatCurrency(utilidad, moneda)}</p></div></div>
      <ProfitBadge porcentaje={calcularMargen(f.venta, costo)} venta={f.venta} />
    </li>;
  })}</ul>;
}