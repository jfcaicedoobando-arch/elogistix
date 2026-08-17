/**
 * Captura manual de conceptos de una factura de proveedor (Q-02, v13.339.0).
 *
 * Se muestra solo cuando la factura NO viene de un XML CFDI: en ese caso el
 * desglose es fiscal e inmutable y se usa `CfdiConceptosPreview`.
 */
import { ListPlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection } from "./facturaFormPrimitives";
import { formatCurrency } from "@/lib/formatters";
import type { ConceptoManual } from "@/features/cxp/hooks/useConceptosManuales";
import type { CfdiConceptoParsed } from "@/features/cxp/services";
import { parseMonto } from "@/lib/format/parseMonto";

interface Props {
  /** Oculta la sección cuando el desglose viene de un CFDI (inmutable). */
  oculta?: boolean;
  conceptos: ReadonlyArray<ConceptoManual>;
  moneda: string;
  /** Renglón sospechoso (línea más alta cuando la suma excede el subtotal). */
  keyResaltado?: string | null;
  onAgregar: () => void;
  onActualizar: <K extends keyof CfdiConceptoParsed>(
    key: string,
    campo: K,
    valor: CfdiConceptoParsed[K],
  ) => void;
  onEliminar: (key: string) => void;
}


function num(v: string): number {
  return parseMonto(v);
}

export function ConceptosManualesSection({
  oculta = false,
  conceptos,
  moneda,
  keyResaltado = null,
  onAgregar,
  onActualizar,
  onEliminar,
}: Props) {
  if (oculta) return null;
  return (
    <FormSection
      icon={<ListPlus className="h-3.5 w-3.5" />}
      title={`Conceptos de la factura (${conceptos.length})`}
    >
      <p className="-mt-1 text-xs text-muted-foreground">
        El precio es <strong>unitario</strong>: el total de línea es precio × cantidad y la suma debe
        cuadrar con el subtotal. Sin conceptos la factura no se puede aprobar ni pagar.
      </p>

      {conceptos.length > 0 && (
        <div className="space-y-2">
          <div className="hidden grid-cols-12 gap-2 px-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span className="col-span-4">Descripción</span>
            <span className="col-span-1 text-right">Cant.</span>
            <span className="col-span-2 text-right">Precio unit.</span>
            <span className="col-span-2 text-right">IVA</span>
            <span className="col-span-2">Unidad</span>
            <span className="col-span-1" />
          </div>

          {conceptos.map((c) => (
            <div
              key={c.key}
              className={
                c.key === keyResaltado
                  ? "rounded-md border border-destructive/50 bg-destructive/5 p-2"
                  : "rounded-md border border-border/60 p-2"
              }
            >
              <div className="grid grid-cols-12 items-center gap-2">
                <Input
                  className="col-span-12 h-9 md:col-span-4"
                  placeholder="Descripción"
                  value={c.descripcion}
                  onChange={(e) => onActualizar(c.key, "descripcion", e.target.value)}
                  aria-label="Descripción del concepto"
                />
                <Input
                  className="col-span-3 h-9 text-right tabular-nums md:col-span-1"
                  inputMode="decimal"
                  placeholder="Cant."
                  value={String(c.cantidad ?? 1)}
                  onChange={(e) => onActualizar(c.key, "cantidad", num(e.target.value))}
                  aria-label="Cantidad"
                />
                <Input
                  className="col-span-4 h-9 text-right tabular-nums md:col-span-2"
                  inputMode="decimal"
                  placeholder="Precio unit."
                  value={String(c.importe ?? 0)}
                  onChange={(e) => onActualizar(c.key, "importe", num(e.target.value))}
                  aria-label="Precio unitario"
                />
                <Input
                  className="col-span-3 h-9 text-right tabular-nums md:col-span-2"
                  inputMode="decimal"
                  placeholder="IVA"
                  value={String(c.iva ?? 0)}
                  onChange={(e) => onActualizar(c.key, "iva", num(e.target.value))}
                  aria-label="IVA del concepto"
                />
                <Input
                  className="col-span-8 h-9 md:col-span-2"
                  placeholder="Unidad"
                  value={c.clave_unidad ?? ""}
                  onChange={(e) => onActualizar(c.key, "clave_unidad", e.target.value)}
                  aria-label="Clave de unidad SAT"
                />
                <div className="col-span-4 flex justify-end md:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => onEliminar(c.key)}
                    aria-label="Eliminar concepto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-1.5 text-right text-2xs text-muted-foreground">
                Total línea:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatCurrency((Number(c.importe) || 0) * (Number(c.cantidad) || 1), moneda)}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={onAgregar}>
        <Plus className="h-4 w-4 mr-1.5" />
        Agregar concepto
      </Button>
    </FormSection>
  );
}

