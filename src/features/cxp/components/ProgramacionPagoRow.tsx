/**
 * Fila "Programación de pago" para el detalle de una factura de proveedor.
 * Permite a Tesorería fijar (o limpiar) `fecha_programada_pago`.
 * Se aisla del `InfoFacturaSection` para respetar el límite de 200 líneas.
 * v13.188.0 — Ola 2 · Item 2.
 */
import { useState, useEffect } from "react";
import { CalendarClock, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProgramarPagoProveedor } from "@/features/cxp/hooks/useProgramarPagoProveedor";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { formatFechaEs } from "@/lib/formatters";

interface Props {
  facturaId: string;
  fechaProgramada: string | null;
  saldo: number;
}

function formatoLocal(iso: string | null): string {
  if (!iso) return "";
  return iso; // yyyy-mm-dd ya es el formato de <input type="date">
}

function formatoBonito(iso: string | null): string | null {
  if (!iso) return null;
  return formatFechaEs(iso, { day: "2-digit", month: "short", year: "numeric" });
}

export function ProgramacionPagoRow({ facturaId, fechaProgramada, saldo }: Props) {
  const [valor, setValor] = useState<string>(formatoLocal(fechaProgramada));
  useEffect(() => setValor(formatoLocal(fechaProgramada)), [fechaProgramada]);

  const prog = useProgramarPagoProveedor();
  const yaSaldada = saldo <= 0.01;
  const bonita = formatoBonito(fechaProgramada);
  const dirty = valor !== formatoLocal(fechaProgramada);

  return (
    <div className="mt-3 pt-3 border-t">
      <div className="flex items-center gap-2 mb-2">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <span className="text-label uppercase tracking-wider text-muted-foreground font-medium">
          Programación de pago
        </span>
        {bonita && !yaSaldada && (
          <Badge variant="secondary" className="text-2xs">Programada · {bonita}</Badge>
        )}
        {yaSaldada && (
          <Badge variant="outline" className="text-2xs">Pagada</Badge>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <DatePickerMx
          value={valor}
          onChange={setValor}
          disabled={yaSaldada || prog.isPending}
          className="h-8 w-auto max-w-[180px] text-xs"
        />
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={yaSaldada || prog.isPending || !dirty || !valor}
          onClick={() => prog.mutate({ facturaId, fecha: valor })}
        >
          {prog.isPending
            ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            : null}
          Guardar
        </Button>
        {fechaProgramada && !yaSaldada && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            disabled={prog.isPending}
            onClick={() => prog.mutate({ facturaId, fecha: null })}
          >
            <X className="h-3 w-3 mr-1" /> Quitar
          </Button>
        )}
      </div>
    </div>
  );
}
