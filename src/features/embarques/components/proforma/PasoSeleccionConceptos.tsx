import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FiltroContenedorChips } from "./FiltroContenedorChips";
import {
  ConceptoRow, TotalesProformaBox, ProformaFooterFields,
} from "./PasoSeleccionConceptos.parts";
import { buildContenedorLabelMap } from "./PasoSeleccionConceptos.helpers";
import type { FiltroContenedor } from "@/features/cotizacion/domain/conceptosPorContenedor";
import type { Tables } from "@/types/db";

type ConceptoVenta = Tables<"conceptos_venta">;
type EmbarqueContenedor = Tables<"embarque_contenedores">;

export interface TotalesProforma {
  subtotal_usd: number;
  iva_usd: number;
  total_usd: number;
  subtotal_mxn: number;
  iva_mxn: number;
  total_mxn: number;
}

interface Props {
  conceptosPendientes: ConceptoVenta[];
  conceptosVisibles: ConceptoVenta[];
  contenedores: EmbarqueContenedor[];
  filtroContenedor: FiltroContenedor;
  onFiltroContenedorChange: (v: FiltroContenedor) => void;
  seleccionados: Set<string>;
  ivaPorConcepto: Record<string, boolean>;
  totales: TotalesProforma;
  tasaIva: number;
  notas: string;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onToggleIva: (id: string, moneda: string) => void;
  onNotasChange: (v: string) => void;
}

export function PasoSeleccionConceptos({
  conceptosPendientes, conceptosVisibles, contenedores,
  filtroContenedor, onFiltroContenedorChange,
  seleccionados, ivaPorConcepto, totales, tasaIva,
  notas,
  onToggle, onToggleAll, onToggleIva, onNotasChange,
}: Props) {

  const visiblesIds = conceptosVisibles.map((c) => c.id);
  const seleccionadosVisibles = visiblesIds.filter((id) => seleccionados.has(id)).length;
  const allSelected = visiblesIds.length > 0 && seleccionadosVisibles === visiblesIds.length;
  const contenedorNumeroById = buildContenedorLabelMap(contenedores);

  return (
    <div className="space-y-4">
      <FiltroContenedorChips
        contenedores={contenedores}
        value={filtroContenedor}
        onChange={onFiltroContenedorChange}
      />
      <div className="border rounded-md">
        <div className="flex items-center justify-between p-3 bg-muted/50 border-b">
          <div className="flex items-center gap-2">
            <Checkbox checked={allSelected} onCheckedChange={onToggleAll} id="all" />
            <Label htmlFor="all" className="text-sm font-medium cursor-pointer">
              Seleccionar todos ({seleccionadosVisibles}/{conceptosVisibles.length})
              {filtroContenedor !== 'todos' && (
                <span className="text-muted-foreground font-normal ml-1">
                  · {conceptosPendientes.length} totales
                </span>
              )}
            </Label>
          </div>
          <span className="text-xs text-muted-foreground">IVA por concepto</span>
        </div>
        <div className="divide-y max-h-[300px] overflow-y-auto">
          {conceptosVisibles.map((c) => {
            const isSelected = seleccionados.has(c.id);
            // Fix v12.94.2: caer al `aplica_iva` real del concepto si el state aún no
            // se inicializó, para evitar ventana donde el switch muestra OFF pese a
            // que el concepto sí lleva IVA.
            const ivaActivo = ivaPorConcepto[c.id] ?? (c.moneda === "MXN" ? true : !!c.aplica_iva);
            const ivaBloqueado = c.moneda === "MXN";
            const contLabel = c.contenedor_id ? contenedorNumeroById.get(c.contenedor_id) ?? null : null;
            return (
              <ConceptoRow
                key={c.id}
                c={c}
                isSelected={isSelected}
                ivaActivo={ivaActivo}
                ivaBloqueado={ivaBloqueado}
                contLabel={contLabel}
                showGeneralBadge={!c.contenedor_id && contenedores.length >= 2}
                onToggle={onToggle}
                onToggleIva={onToggleIva}
              />
            );
          })}
          {conceptosVisibles.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No hay conceptos en este filtro.
            </div>
          )}
        </div>
      </div>

      <TotalesProformaBox
        totales={totales}
        tasaIva={tasaIva}
        seleccionadosVisibles={seleccionadosVisibles}
      />

      <ProformaFooterFields
        notas={notas}
        diasCredito={diasCredito}
        operadorEmbarque={operadorEmbarque}
        onNotasChange={onNotasChange}
        onDiasCreditoChange={onDiasCreditoChange}
      />
    </div>
  );
}
