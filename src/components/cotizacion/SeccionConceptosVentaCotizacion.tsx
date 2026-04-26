import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { ConceptoVentaCotizacion } from "@/hooks/cotizacion/useCotizaciones";
import { formatCurrency } from "@/lib/formatters";
import { useTasaIVA } from "@/hooks/catalogos/useTasaIVA";
import { ConceptoRowUSD, ConceptoRowMXN } from "./conceptos/ConceptoRows";

interface Props {
  conceptosUSD: ConceptoVentaCotizacion[];
  conceptosMXN: ConceptoVentaCotizacion[];
  actualizarConceptoUSD: (index: number, campo: string, valor: string | number | boolean) => void;
  actualizarConceptoMXN: (index: number, campo: string, valor: string | number | boolean) => void;
  agregarConceptoUSD: () => void;
  agregarConceptoMXN: () => void;
  eliminarConceptoUSD: (index: number) => void;
  eliminarConceptoMXN: (index: number) => void;
  totalUSD: number;
  subtotalMXN: number;
  ivaMXN: number;
  totalMXN: number;
}

export default function SeccionConceptosVentaCotizacion({
  conceptosUSD, conceptosMXN,
  actualizarConceptoUSD, actualizarConceptoMXN,
  agregarConceptoUSD, agregarConceptoMXN,
  eliminarConceptoUSD, eliminarConceptoMXN,
  totalUSD, subtotalMXN, ivaMXN, totalMXN,
}: Props) {
  const tasaIva = useTasaIVA();
  const hayIvaUSD = conceptosUSD.some(c => c.aplica_iva);
  const subtotalSinIvaUSD = conceptosUSD.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
  const ivaUSD = totalUSD - subtotalSinIvaUSD;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Conceptos en USD</CardTitle>
            <Button variant="outline" size="sm" onClick={agregarConceptoUSD}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {conceptosUSD.map((c, i) => (
            <ConceptoRowUSD
              key={i}
              concepto={c}
              index={i}
              total={conceptosUSD.length}
              actualizar={actualizarConceptoUSD}
              eliminar={eliminarConceptoUSD}
            />
          ))}
          <div className="flex flex-col items-end gap-1 pt-2 border-t">
            {hayIvaUSD ? (
              <>
                <span className="text-sm">Subtotal s/IVA: {formatCurrency(subtotalSinIvaUSD, 'USD')}</span>
                <span className="text-sm text-amber-600">IVA 16%: {formatCurrency(ivaUSD, 'USD')}</span>
                <span className="text-sm font-semibold">Total USD: {formatCurrency(totalUSD, 'USD')}</span>
              </>
            ) : (
              <span className="text-sm font-semibold">Total USD: {formatCurrency(totalUSD, 'USD')}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Conceptos en MXN + IVA</CardTitle>
            <Button variant="outline" size="sm" onClick={agregarConceptoMXN}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {conceptosMXN.map((c, i) => (
            <ConceptoRowMXN
              key={i}
              concepto={c}
              index={i}
              total={conceptosMXN.length}
              actualizar={actualizarConceptoMXN}
              eliminar={eliminarConceptoMXN}
              tasaIva={tasaIva}
            />
          ))}
          <div className="flex flex-col items-end gap-1 pt-2 border-t">
            <span className="text-sm">Subtotal MXN: {formatCurrency(subtotalMXN, 'MXN')}</span>
            <span className="text-sm">IVA (16%): {formatCurrency(ivaMXN, 'MXN')}</span>
            <span className="text-sm font-semibold">Total MXN: {formatCurrency(totalMXN, 'MXN')}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-end gap-1 p-4 border rounded-md bg-muted/30">
        <span className="text-base font-bold">Total USD: {formatCurrency(totalUSD, 'USD')}</span>
        <span className="text-base font-bold">Total MXN (c/IVA): {formatCurrency(totalMXN, 'MXN')}</span>
        <span className="text-xs text-muted-foreground">* Los conceptos en MXN incluyen IVA 16%</span>
        {hayIvaUSD && <span className="text-xs text-amber-600">* Algunos conceptos USD incluyen IVA 16%</span>}
      </div>
    </div>
  );
}
