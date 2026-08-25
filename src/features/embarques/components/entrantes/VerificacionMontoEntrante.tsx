/**
 * v13.503.0 — Verificación del monto facturado contra lo costeado.
 *
 * Operaciones captura (o confirma) el monto de la factura y ve de inmediato si
 * cuadra con los costos del proveedor en el embarque. Es un aviso, no un
 * bloqueo: el documento siempre se puede enviar al buzón.
 */
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/shared/MoneyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters/numbers";
import { cn } from "@/lib/utils";
import { MONEDAS_ENTRANTE } from "@/features/embarques/components/entrantes/monedasEntrante";
import {
  cotejarMontoFacturado,
  montoDifiereDelCfdi,
} from "@/features/embarques/domain/montoEntranteCotejo";


interface Props {
  monto: number | null;
  moneda: string;
  onMonto: (valor: number | null) => void;
  onMoneda: (valor: string) => void;
  /**
   * Importe de referencia del CFDI: el SUBTOTAL (sin IVA) cuando el XML lo
   * trae, porque los costos del ERP se manejan sin impuestos.
   */
  totalCfdi: number | null;
  /** Suma de costos vivos del proveedor por moneda. */
  costeadoPorMoneda: Readonly<Record<string, number>> | null | undefined;
  cargandoCostos: boolean;
  proveedorElegido: boolean;
  /** v13.618.0 — Suma de los conceptos marcados en la moneda actual. */
  sumaSugerida?: number | null;
  onUsarSumaSugerida?: () => void;
}

function Aviso({
  tono,
  icono: Icono,
  children,
}: {
  tono: "ok" | "alerta" | "neutro";
  icono: typeof Info;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border p-2.5 text-body-sm",
        tono === "ok" && "border-success/40 bg-success/10",
        tono === "alerta" && "border-warning/40 bg-warning/10",
        tono === "neutro" && "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <Icono
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          tono === "ok" && "text-success",
          tono === "alerta" && "text-warning",
          tono === "neutro" && "text-muted-foreground",
        )}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function MensajeCotejo({ monto, moneda, costeadoPorMoneda, cargandoCostos, proveedorElegido }: Props) {
  if (!proveedorElegido) {
    return <Aviso tono="neutro" icono={Info}>Elige el proveedor para comparar contra lo costeado.</Aviso>;
  }
  if (cargandoCostos) {
    return <Aviso tono="neutro" icono={Info}>Consultando los costos del proveedor…</Aviso>;
  }
  const cotejo = cotejarMontoFacturado({ monto, moneda, costeadoPorMoneda });
  if (cotejo.estado === "sin_datos") {
    return (
      <Aviso tono="neutro" icono={Info}>
        No hay costos comparables en {moneda} para este proveedor en el embarque.
      </Aviso>
    );
  }
  const costeado = formatCurrency(cotejo.costeado ?? 0, moneda);
  if (cotejo.estado === "coincide") {
    return (
      <Aviso tono="ok" icono={CheckCircle2}>
        Coincide con lo costeado ({costeado}).
      </Aviso>
    );
  }
  const signo = cotejo.diferencia > 0 ? "+" : "−";
  const pct = Math.abs(cotejo.porcentaje * 100).toFixed(1);
  return (
    <Aviso tono="alerta" icono={AlertTriangle}>
      Facturado {formatCurrency(monto ?? 0, moneda)} vs costeado {costeado} ·{" "}
      {signo}
      {formatCurrency(Math.abs(cotejo.diferencia), moneda)} ({pct}%). Puedes enviarlo igual;
      contabilidad lo revisará.
    </Aviso>
  );
}

export function VerificacionMontoEntrante(props: Props) {
  const { monto, moneda, onMonto, onMoneda, totalCfdi, sumaSugerida, onUsarSumaSugerida } = props;
  const difiereCfdi = montoDifiereDelCfdi(monto, totalCfdi);
  const falta = monto == null || monto <= 0;
  const puedeCopiarSuma = Boolean(onUsarSumaSugerida && sumaSugerida && sumaSugerida > 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="entrante-monto">
            Monto de la factura sin IVA <span className="text-destructive">*</span>
          </Label>
          <MoneyInput
            id="entrante-monto"
            value={monto}
            currency={moneda}
            onChange={(n) => onMonto(n > 0 ? n : null)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="entrante-moneda">Moneda</Label>
          <Select value={moneda} onValueChange={onMoneda}>
            <SelectTrigger id="entrante-moneda" className="w-full sm:w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONEDAS_ENTRANTE.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {falta && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-body-sm text-destructive">
            Captura el importe: sin él contabilidad no puede priorizar ni cotejar el documento.
          </p>
          {puedeCopiarSuma && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-body-sm"
              onClick={onUsarSumaSugerida}
            >
              Usar la suma de lo marcado ({formatCurrency(sumaSugerida ?? 0, moneda)})
            </Button>
          )}
        </div>
      )}
      {totalCfdi != null && !difiereCfdi && (
        <p className="text-body-sm text-muted-foreground">
          Subtotal sin IVA leído del CFDI; puedes ajustarlo si hace falta.
        </p>
      )}
      {difiereCfdi && (
        <Aviso tono="alerta" icono={AlertTriangle}>
          El monto capturado no coincide con el subtotal sin IVA del CFDI (
          {formatCurrency(totalCfdi ?? 0, moneda)}).
        </Aviso>
      )}
      <MensajeCotejo {...props} />
    </div>
  );
}
