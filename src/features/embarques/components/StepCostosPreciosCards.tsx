/**
 * Tarjetas de tabla para `StepCostosPrecios`: una para conceptos de Costo,
 * otra para conceptos de Venta. Extraídas para mantener el step ≤200 líneas.
 */
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilaCostoPrecio } from "@/features/embarques/components/conceptos/FilaCostoPrecio";
import { FilaVentaPrecio } from "@/features/embarques/components/conceptos/FilaVentaPrecio";
import type { ConceptoVentaLocal as ConceptoVentaRow, ConceptoCostoLocal as ConceptoCostoRow } from "@/types/concepto";

interface Proveedor { id: string; nombre: string }

interface CostosCardProps {
  cols: string;
  showContenedorCol: boolean;
  conceptos: ConceptoCostoRow[];
  toUSD: (m: number, mo: string) => number;
  mixtoIdx: Set<number>;
  proveedoresDb: Proveedor[];
  embarqueId?: string;
  tcUSD: number;
  tcEUR: number;
  update: (id: number, field: keyof ConceptoCostoRow, value: string | number | boolean | null) => void;
  remove: (id: number) => void;
  onAdd: () => void;
  totalUSD: number;
  filasMixtasCount: number;
}

export function CostosCard(p: CostosCardProps) {
  return (
    <Card>
      <CardHeader><CardTitle>Costos directos del embarque</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className={`grid ${p.cols} gap-2 text-body-sm font-medium text-muted-foreground`}>
            <span>Proveedor</span><span>Concepto</span><span>Subtotal (sin IVA)</span><span>Moneda</span>
            {p.showContenedorCol && <span>Contenedor</span>}
            <span>Total USD</span><span></span>
          </div>
          {p.conceptos.map((costo, idx) => (
            <FilaCostoPrecio
              key={costo.id}
              costo={costo}
              totalUSD={p.toUSD(costo.monto, costo.moneda)}
              esMixta={p.mixtoIdx.has(idx)}
              proveedoresDb={p.proveedoresDb}
              cols={p.cols}
              showContenedorCol={p.showContenedorCol}
              embarqueId={p.embarqueId}
              tcUSD={p.tcUSD}
              tcEUR={p.tcEUR}
              disableRemove={p.conceptos.length <= 1}
              update={p.update}
              remove={p.remove}
            />
          ))}
          <Button variant="outline" size="sm" onClick={p.onAdd}>+ Agregar costo</Button>
          <div className="border-t pt-3 mt-3 text-body text-right">
            <div className="flex justify-end gap-4"><span className="font-semibold">Total USD:</span><span className="font-bold w-28 text-right">{formatCurrency(p.totalUSD, 'USD')}</span></div>
            {p.filasMixtasCount > 0 && (
              <p className="text-body-sm text-warning mt-1">
                {p.filasMixtasCount} fila(s) convertida(s) a USD con TC vigente.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface VentasCardProps {
  cols: string;
  showContenedorCol: boolean;
  conceptos: ConceptoVentaRow[];
  toUSD: (m: number, mo: string) => number;
  mixtoIdx: Set<number>;
  embarqueId?: string;
  tcUSD: number;
  update: (id: number, field: keyof ConceptoVentaRow, value: string | number | boolean | null) => void;
  remove: (id: number) => void;
  onAdd: () => void;
  totalUSD: number;
  filasMixtasCount: number;
}

export function VentasCard(p: VentasCardProps) {
  return (
    <Card>
      <CardHeader><CardTitle>Conceptos de Venta</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className={`grid ${p.cols} gap-2 text-body-sm font-medium text-muted-foreground`}>
            <span>Concepto</span><span>Cantidad</span><span>Subtotal (sin IVA)</span><span>Moneda</span>
            {p.showContenedorCol && <span>Contenedor</span>}
            <span>Total USD</span><span></span>
          </div>
          {p.conceptos.map((venta, idx) => (
            <FilaVentaPrecio
              key={venta.id}
              venta={venta}
              totalUSD={p.toUSD(venta.precioUnitario, venta.moneda)}
              esMixta={p.mixtoIdx.has(idx)}
              cols={p.cols}
              showContenedorCol={p.showContenedorCol}
              embarqueId={p.embarqueId}
              tcUSD={p.tcUSD}
              disableRemove={p.conceptos.length <= 1}
              update={p.update}
              remove={p.remove}
            />
          ))}
          <Button variant="outline" size="sm" onClick={p.onAdd}>+ Agregar concepto</Button>
          <div className="border-t pt-3 mt-3 text-body text-right">
            <div className="flex justify-end gap-4"><span className="font-semibold">Total USD:</span><span className="font-bold w-28 text-right">{formatCurrency(p.totalUSD, 'USD')}</span></div>
            {p.filasMixtasCount > 0 && (
              <p className="text-body-sm text-warning mt-1">
                {p.filasMixtasCount} fila(s) convertida(s) a USD con TC vigente.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
