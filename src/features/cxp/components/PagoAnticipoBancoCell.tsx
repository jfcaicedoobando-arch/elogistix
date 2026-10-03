import { ToneBadge } from "@/components/shared/ToneBadge";
import { formatCurrency, formatFechaDia } from "@/lib/formatters";
import type { OrigenPagoAnticipo } from "../domain/pagoAnticipoOrigen";

/** Una aplicación consume saldo a favor; jamás ofrece vincular otro cargo. */
export function PagoAnticipoBancoCell({ origen }: { origen: OrigenPagoAnticipo }) {
  return <div className="flex flex-col gap-1 text-body-sm">
    <ToneBadge tone={origen.tipo === "inconsistente" ? "warning" : "info"} size="md">
      {origen.tipo === "inconsistente" ? "Anticipo por revisar" : "Aplicación de anticipo"}
    </ToneBadge>
    <span className="text-label text-muted-foreground">
      {origen.tipo === "efectivo" ? "Anticipo en efectivo: no genera movimiento bancario."
        : origen.movimiento && origen.moneda ? `Cargo original del anticipo: ${formatFechaDia(origen.movimiento.fecha)} · ${formatCurrency(Number(origen.movimiento.cargo), origen.moneda)}`
        : "Revisa la aplicación y el cargo original del anticipo en la conciliación."}
    </span>
    <span className="text-label text-muted-foreground">Para corregirla, revierte la aplicación y vuelve a aplicar el anticipo. El cargo original se conserva.</span>
  </div>;
}
