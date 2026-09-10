/**
 * Atajos de captura de la nota de crédito: acreditar el saldo completo,
 * elegir conceptos de la factura original o aplicar un descuento en %.
 * Evita que el usuario calcule importes a mano (v13.823.297).
 */
import { useState } from "react";
import { Percent, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/formatters/numbers";
import { subtotalLinea } from "@/lib/financial/financialUtils";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";

interface Props {
  saldoFactura: number;
  monedaFactura: string;
  conceptosSugeridos: ConceptoNotaCredito[];
  onSaldoCompleto: () => void;
  onDescuento: (porcentaje: number) => void;
  onSeleccion: (indices: number[]) => void;
}

export function NotaCreditoAtajos(props: Props) {
  const { saldoFactura, monedaFactura, conceptosSugeridos, onSaldoCompleto, onDescuento, onSeleccion } = props;
  const [porcentaje, setPorcentaje] = useState("");
  const [marcados, setMarcados] = useState<number[]>(() => conceptosSugeridos.map((_, i) => i));

  const toggle = (i: number) => {
    const next = marcados.includes(i) ? marcados.filter((x) => x !== i) : [...marcados, i].sort();
    setMarcados(next);
    onSeleccion(next);
  };

  const pct = Number(porcentaje);
  const pctValido = Number.isFinite(pct) && pct > 0 && pct <= 100;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <Label>¿Qué se acredita?</Label>

      <div className="flex flex-wrap items-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onSaldoCompleto}>
          <Wallet className="mr-1 h-3.5 w-3.5" />
          Por el saldo completo ({formatCurrency(saldoFactura, monedaFactura)})
        </Button>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label size="sm" htmlFor="nc-pct">Descuento %</Label>
            <Input
              id="nc-pct"
              inputMode="decimal"
              className="h-9 w-24"
              placeholder="10"
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
            />
          </div>
          <Button
            type="button" variant="secondary" size="sm"
            disabled={!pctValido}
            onClick={() => onDescuento(pct)}
          >
            <Percent className="mr-1 h-3.5 w-3.5" /> Aplicar
          </Button>
        </div>
      </div>

      {conceptosSugeridos.length > 0 && (
        <div className="space-y-1.5">
          <Label size="sm">Conceptos de la factura</Label>
          <div className="space-y-1">
            {conceptosSugeridos.map((c, i) => (
              <label key={i} className="flex items-center gap-2 text-body-sm">
                <Checkbox
                  checked={marcados.includes(i)}
                  onCheckedChange={() => toggle(i)}
                  aria-label={`Acreditar ${c.descripcion}`}
                />
                <span className="truncate">{c.descripcion}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {formatCurrency(
                    subtotalLinea(Number(c.cantidad), Number(c.precio_unitario)),
                    monedaFactura,
                  )}
                </span>
              </label>
            ))}
          </div>
          <p className="text-label text-muted-foreground">
            Puedes ajustar cantidades y precios abajo después de elegir.
          </p>
        </div>
      )}
    </div>
  );
}
