/**
 * Captura manual de conceptos de una factura de proveedor (Q-02, v13.339.0).
 *
 * Se muestra solo cuando la factura NO viene de un XML CFDI: en ese caso el
 * desglose es fiscal e inmutable y se usa `CfdiConceptosPreview`.
 *
 * v13.629.0 — Se convirtió en tabla con encabezados, total por línea, duplicar
 * y IVA 16% por renglón; cada partida vive en `ConceptoLineaRow`.
 */
import { ListPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { FormSection } from "./facturaFormPrimitives";
import { ConceptosTablaHeader } from "./ConceptosTablaHeader";
import { ConceptoLineaRow } from "./ConceptoLineaRow";
import type { ConceptoManual } from "@/features/cxp/hooks/useConceptosManuales";
import type { CfdiConceptoParsed } from "@/features/cxp/services";

interface Props {
  /** Oculta la sección cuando el desglose viene de un CFDI (inmutable). */
  oculta?: boolean;
  conceptos: ReadonlyArray<ConceptoManual>;
  moneda: string;
  /** Renglón sospechoso (línea más alta cuando la suma no cuadra). */
  keyResaltado?: string | null;
  onAgregar: () => void;
  onActualizar: <K extends keyof CfdiConceptoParsed>(
    key: string,
    campo: K,
    valor: CfdiConceptoParsed[K],
  ) => void;
  onEliminar: (key: string) => void;
  onDuplicar?: (key: string) => void;
}

export function ConceptosManualesSection({
  oculta = false,
  conceptos,
  moneda,
  keyResaltado = null,
  onAgregar,
  onActualizar,
  onEliminar,
  onDuplicar,
}: Props) {
  if (oculta) return null;
  return (
    <FormSection
      icon={<ListPlus className="h-3.5 w-3.5" />}
      title={`Conceptos de la factura (${conceptos.length})`}
    >
      <p className="-mt-1 text-body-sm text-muted-foreground">
        El precio es <strong>unitario</strong>: el total de línea es precio × cantidad y la suma debe
        cuadrar con el subtotal. Sin conceptos la factura no se puede aprobar ni pagar.
      </p>

      {conceptos.length === 0 ? (
        <div className="rounded-lg border border-dashed">
          <EmptyStateInline
            icon={ListPlus}
            message="Aún no hay partidas"
            hint="Agrega una línea por cada servicio de la factura."
            className="py-6"
          />
          <div className="flex justify-center pb-5">
            <Button type="button" variant="outline" size="sm" onClick={onAgregar}>
              <Plus className="mr-1.5 h-4 w-4" />
              Agregar concepto
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <ConceptosTablaHeader />
          {conceptos.map((c) => (
            <ConceptoLineaRow
              key={c.key}
              concepto={c}
              moneda={moneda}
              resaltado={c.key === keyResaltado}
              onActualizar={onActualizar}
              onEliminar={onEliminar}
              onDuplicar={onDuplicar}
              onAgregarSiguiente={onAgregar}
            />
          ))}
          <Button type="button" variant="outline" size="sm" onClick={onAgregar}>
            <Plus className="mr-1.5 h-4 w-4" />
            Agregar concepto
          </Button>
        </div>
      )}
    </FormSection>
  );
}
