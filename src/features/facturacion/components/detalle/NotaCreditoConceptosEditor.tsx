/**
 * Editor de conceptos para DialogCrearNotaCredito. Extraído para
 * mantener el dialog ≤ 200 líneas.
 *
 * v13.823.297 — los totales salieron a `NotaCreditoResumen`; cada renglón
 * muestra su importe con formato de moneda.
 *
 * P1-IVA — el tratamiento fiscal de los renglones COPIADOS del CFDI original es
 * de sólo lectura (la NC debe reversar exactamente lo timbrado). Un renglón
 * capturado a mano sí exige elegirlo: nunca nace al 16% por omisión.
 */
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/shared/NumericInput";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters/numbers";
import { subtotalLinea } from "@/lib/financial/financialUtils";
import {
  etiquetaTratamientoNC,
  tasaCanonicaNC,
  TRATAMIENTOS_NC,
  type TratamientoNC,
} from "@/features/facturacion/utils/impuestosNotaCredito";
import { TIPO_IVA_LABEL_SAT } from "@/lib/financial/tipoIvaSat";
import { useIvaFronteraHabilitada } from "@/features/configuracion";
import {
  AVISO_IVA_FRONTERA_DESHABILITADO,
  TIPO_IVA_FRONTERA,
} from "@/lib/financial/ivaFrontera";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";

interface Props {
  conceptos: ConceptoNotaCredito[];
  monedaFactura: string;
  onAdd: () => void;
  onUpdate: (i: number, patch: Partial<ConceptoNotaCredito>) => void;
  onRemove: (i: number) => void;
}

/** Selector de tratamiento fiscal para un renglón capturado a mano. */
function TratamientoSelect({
  concepto,
  indice,
  fronteraHabilitada,
  onUpdate,
}: {
  concepto: ConceptoNotaCredito;
  indice: number;
  fronteraHabilitada: boolean;
  onUpdate: Props["onUpdate"];
}) {
  return (
    <div className="col-span-11 space-y-1">
      <Label size="sm" htmlFor={`nc-tratamiento-${indice}`}>
        Tratamiento fiscal de IVA *
      </Label>
      <Select
        value={concepto.tipo_iva ?? undefined}
        onValueChange={(v) => {
          const tipo = v as TratamientoNC;
          if (tipo === TIPO_IVA_FRONTERA && !fronteraHabilitada) return;
          onUpdate(indice, { tipo_iva: tipo, tasa_iva: tasaCanonicaNC(tipo) });
        }}
      >
        <SelectTrigger id={`nc-tratamiento-${indice}`} className="h-10">
          <SelectValue placeholder="Elige el tratamiento de la factura original" />
        </SelectTrigger>
        <SelectContent>
          {TRATAMIENTOS_NC.map((tipo) => (
            <SelectItem
              key={tipo}
              value={tipo}
              disabled={tipo === TIPO_IVA_FRONTERA && !fronteraHabilitada}
              title={
                tipo === TIPO_IVA_FRONTERA && !fronteraHabilitada
                  ? AVISO_IVA_FRONTERA_DESHABILITADO
                  : undefined
              }
            >
              {TIPO_IVA_LABEL_SAT[tipo]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}


export function NotaCreditoConceptosEditor(props: Props) {
  const { conceptos, monedaFactura, onAdd, onUpdate, onRemove } = props;
  const fronteraHabilitada = useIvaFronteraHabilitada();
  return (

    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Conceptos *</Label>
        <Button type="button" variant="ghost" size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
        </Button>
      </div>
      <div className="space-y-2">
        {conceptos.map((c, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2">
            <div className="col-span-12 sm:col-span-5 space-y-1">
              <Label size="sm">Descripción</Label>
              <Input
                value={c.descripcion}
                onChange={(e) => onUpdate(i, { descripcion: e.target.value })}
                placeholder="Descripción del concepto"
                aria-label={`Descripción del concepto ${i + 1}`}
              />
            </div>
            <div className="col-span-3 sm:col-span-2 space-y-1">
              <Label size="sm">Cant.</Label>
              <NumericInput
                aria-label="Cantidad"
                decimals
                value={c.cantidad || 0}
                onChange={(n) => onUpdate(i, { cantidad: n })}
                className="h-10"
              />
            </div>
            <div className="col-span-5 sm:col-span-2 space-y-1">
              <Label size="sm">P. Unitario</Label>
              <NumericInput
                aria-label="Precio unitario"
                decimals
                value={c.precio_unitario || 0}
                onChange={(n) => onUpdate(i, { precio_unitario: n })}
                className="h-10"
              />
            </div>
            <div className="col-span-3 sm:col-span-2 space-y-1">
              <Label size="sm">Importe</Label>
              <p className="h-10 flex items-center justify-end tabular-nums text-body-sm">
                {formatCurrency(
                  subtotalLinea(Number(c.cantidad), Number(c.precio_unitario)),
                  monedaFactura,
                )}
              </p>
            </div>
            {/* P1-IVA: el tratamiento de un renglón copiado del CFDI original es
                de sólo lectura (la NC reversa exactamente los mismos impuestos);
                un renglón capturado a mano se elige explícitamente. */}
            {c.es_manual ? (
              <TratamientoSelect
                concepto={c}
                indice={i}
                fronteraHabilitada={fronteraHabilitada}
                onUpdate={onUpdate}
              />
            ) : (
              <p className="col-span-11 text-label text-muted-foreground">
                {etiquetaTratamientoNC(c)}
              </p>
            )}

            <div className="col-span-1 flex justify-end">
              <Button
                type="button" variant="ghost" size="icon"
                onClick={() => onRemove(i)} disabled={conceptos.length === 1}
                aria-label="Eliminar concepto"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
