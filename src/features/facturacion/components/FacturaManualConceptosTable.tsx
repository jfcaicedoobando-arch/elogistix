/**
 * Tabla editable de conceptos para factura manual.
 * Cada renglón lleva su propio régimen de IVA (16% / 0% / Exento).
 * v13.315.2: cabecera de tabla real + botón link para agregar. El resumen
 * del total lo pinta ahora el propio `DialogNuevaFacturaManual` en su panel
 * navy, así que aquí ya no rendereamos el pie de totales.
 */
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/shared/NumericInput";
import { SectionHeading } from "@/components/shared/SectionHeading";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";
import type { Moneda } from "@/types/db";
import { useIvaFronteraHabilitada } from "@/features/configuracion";
import { AVISO_IVA_FRONTERA_DESHABILITADO } from "@/lib/financial/ivaFrontera";
import { subtotalLinea } from "@/lib/financial/financialUtils";

interface Props {
  conceptos: ConceptoManualInput[];
  moneda: Moneda;
  onChange: (next: ConceptoManualInput[]) => void;
}

export function FacturaManualConceptosTable({ conceptos, moneda, onChange }: Props) {
  // P2-IVA: el 8% de frontera es un estímulo; si la organización no lo tiene
  // habilitado la opción se deshabilita aquí (el servidor sigue siendo la
  // autoridad y rechaza el timbrado, fail-closed).
  const fronteraHabilitada = useIvaFronteraHabilitada();
  const update = (idx: number, patch: Partial<ConceptoManualInput>) => {
    onChange(conceptos.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const add = () => {
    onChange([
      ...conceptos,
      { descripcion: "", cantidad: 1, precio_unitario: 0, clave_sat: "78101800", tipo_iva: "gravado_16" },
    ]);
  };
  const remove = (idx: number) => {
    if (conceptos.length === 1) return;
    onChange(conceptos.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <SectionHeading
        as="h3"
        variant="overline"
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={add}
            className="text-primary hover:text-primary hover:bg-primary/10"
          >
            <Plus className="h-4 w-4 mr-1" /> Agregar concepto
          </Button>
        }
      >
        Conceptos <span className="text-destructive">*</span>
      </SectionHeading>
      <div className="border rounded-lg overflow-hidden">
        <div className="divide-y">
          {conceptos.map((c, idx) => {
            const importe = subtotalLinea(Number(c.cantidad || 0), Number(c.precio_unitario || 0));
            return (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 px-3 py-3 items-end">
                <div className="min-w-0 sm:col-span-8">
                  <label className="block text-label text-muted-foreground mb-1" htmlFor={`concepto-descripcion-${idx}`}>Descripción</label>
                  <Input
                    id={`concepto-descripcion-${idx}`}
                    value={c.descripcion}
                    onChange={(e) => update(idx, { descripcion: e.target.value })}
                    placeholder="Ej. Anticipo servicios logísticos"
                    className="h-9"
                    aria-label={`Descripción del concepto ${idx + 1}`}
                  />
                </div>
                <div className="min-w-0 sm:col-span-4">
                  <label className="block text-label text-muted-foreground mb-1" htmlFor={`concepto-clave-${idx}`}>Clave SAT</label>
                  <Input
                    id={`concepto-clave-${idx}`}
                    value={c.clave_sat ?? ""}
                    onChange={(e) => update(idx, { clave_sat: e.target.value })}
                    placeholder="78101800"
                    className="h-9 font-mono text-body-sm"
                    aria-label={`Clave SAT del concepto ${idx + 1}`}
                  />
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <span className="block text-label text-muted-foreground mb-1">Cant.</span>
                  <NumericInput
                    aria-label={`Cantidad del concepto ${idx + 1}`}
                    value={c.cantidad || 0}
                    onChange={(n) => update(idx, { cantidad: n || 1 })}
                    className="h-9"
                  />
                </div>
                <div className="min-w-0 sm:col-span-3">
                  <span className="block text-label text-muted-foreground mb-1">P. unitario</span>
                  <NumericInput
                    aria-label={`Precio unitario del concepto ${idx + 1}`}
                    decimals
                    value={c.precio_unitario || 0}
                    onChange={(n) => update(idx, { precio_unitario: n })}
                    className="h-9"
                  />
                </div>
                <div className="min-w-0 sm:col-span-3">
                  <span className="block text-label text-muted-foreground mb-1">IVA</span>
                  <Select
                    value={c.tipo_iva ?? "gravado_16"}
                    onValueChange={(v) => update(idx, { tipo_iva: v as TipoIvaConcepto })}
                  >
                    <SelectTrigger className="h-9" aria-label={`IVA del concepto ${idx + 1}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gravado_16">IVA 16%</SelectItem>
                      <SelectItem
                        value="gravado_8"
                        disabled={!fronteraHabilitada && c.tipo_iva !== "gravado_8"}
                        title={fronteraHabilitada ? undefined : AVISO_IVA_FRONTERA_DESHABILITADO}
                      >
                        IVA 8% (frontera)
                      </SelectItem>
                      <SelectItem value="tasa_0">Tasa 0%</SelectItem>
                      <SelectItem value="exento">Exento</SelectItem>
                      <SelectItem value="no_objeto">No objeto de impuesto (SAT 01)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 sm:col-span-4">
                  <span className="block text-label text-muted-foreground mb-1 text-right">Importe</span>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-body-sm tabular-nums font-medium text-right whitespace-nowrap">
                      {formatCurrency(importe, moneda)}
                    </span>
                    <Button
                      type="button" variant="ghost" size="icon"
                      onClick={() => remove(idx)}
                      disabled={conceptos.length === 1}
                      aria-label={`Eliminar concepto ${idx + 1}`}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {!fronteraHabilitada && (
          <p className="text-label text-muted-foreground">
            {AVISO_IVA_FRONTERA_DESHABILITADO}
          </p>
        )}
      </div>

    </div>
  );
}
