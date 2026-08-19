/**
 * v13.506.0 — El operador marca a qué conceptos de costo del embarque
 * corresponde la factura que sube al buzón.
 *
 * Es una sugerencia para contabilidad: nunca valida montos ni bloquea la
 * subida, sólo exige que el operador diga algo (marcar conceptos o declarar
 * que el documento no corresponde a un costo ya capturado).
 */
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { ConceptoCostoEmbarque } from "@/features/embarques/services";
import type { ConceptoSugeridoSeleccion } from "@/features/cxp/hooks";

interface Props {
  conceptos: readonly ConceptoCostoEmbarque[] | undefined;
  cargando: boolean;
  proveedorElegido: boolean;
  seleccion: Readonly<Record<string, ConceptoSugeridoSeleccion>>;
  sinCostoCapturado: boolean;
  onToggle: (concepto: ConceptoCostoEmbarque, marcado: boolean) => void;
  onMonto: (conceptoId: string, monto: number) => void;
  onSinCosto: (valor: boolean) => void;
}

function FilaConcepto({
  concepto, sel, onToggle, onMonto,
}: {
  concepto: ConceptoCostoEmbarque;
  sel: ConceptoSugeridoSeleccion | undefined;
  onToggle: Props["onToggle"];
  onMonto: Props["onMonto"];
}) {
  const marcado = Boolean(sel);
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-body">
      <Checkbox
        id={`concepto-${concepto.id}`}
        checked={marcado}
        disabled={concepto.yaFacturado}
        onCheckedChange={(v) => onToggle(concepto, !!v)}
        aria-label={`Marcar ${concepto.concepto}`}
      />
      <div className="min-w-0 flex-1">
        <Label
          htmlFor={`concepto-${concepto.id}`}
          className="block truncate font-normal"
          title={concepto.concepto}
        >
          {concepto.concepto}
        </Label>
        <div className="flex items-center gap-2 text-body-sm text-muted-foreground">
          <span>Costeado: {formatCurrency(concepto.monto, concepto.moneda)}</span>
          {concepto.yaFacturado && (
            <Badge variant="secondary" className="h-4 px-1.5 text-2xs">ya facturado</Badge>
          )}
        </div>
      </div>
      {marcado && (
        <div className="flex items-center gap-1.5">
          <span className="text-body-sm text-muted-foreground">{concepto.moneda}</span>
          <MoneyInput
            value={sel?.monto ?? 0}
            currency={concepto.moneda}
            onChange={(n) => onMonto(concepto.id, n)}
            aria-label={`Importe sugerido de ${concepto.concepto}`}
            className="h-8 w-28"
          />
        </div>
      )}
    </div>
  );
}

export function ConceptosSugeridosEntrante({
  conceptos, cargando, proveedorElegido, seleccion, sinCostoCapturado,
  onToggle, onMonto, onSinCosto,
}: Props) {
  if (!proveedorElegido) {
    return (
      <p className="text-body-sm text-muted-foreground">
        Elige el proveedor para ver sus conceptos de costo en este embarque.
      </p>
    );
  }
  if (cargando) {
    return <p className="text-body-sm text-muted-foreground">Consultando los conceptos del embarque…</p>;
  }

  const lista = conceptos ?? [];
  const disponibles = lista.filter((c) => !c.yaFacturado);

  return (
    <div className="space-y-2">
      {lista.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          Este proveedor no tiene conceptos de costo pendientes en el embarque.
        </p>
      ) : (
        <div className="divide-y rounded-md border bg-muted/20">
          {lista.map((c) => (
            <FilaConcepto
              key={c.id}
              concepto={c}
              sel={seleccion[c.id]}
              onToggle={onToggle}
              onMonto={onMonto}
            />
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 pt-1">
        <Checkbox
          id="entrante-sin-costo"
          checked={sinCostoCapturado}
          onCheckedChange={(v) => onSinCosto(!!v)}
        />
        <Label size="sm" htmlFor="entrante-sin-costo" className="font-normal leading-tight">
          Este documento no corresponde a un costo ya capturado
          {disponibles.length === 0 && lista.length === 0
            ? " (marcado por no haber conceptos pendientes)"
            : ""}
        </Label>
      </div>
    </div>
  );
}
