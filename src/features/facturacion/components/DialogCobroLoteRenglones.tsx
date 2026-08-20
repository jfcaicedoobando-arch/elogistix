/**
 * Tabla de reparto del cobro en lote de cliente.
 * Separada del diálogo para respetar el límite de 200 líneas por componente.
 */
import { CobroLoteRenglon } from "./CobroLoteRenglon";
import { LoteRenglonesTable } from "@/components/shared/LoteRenglonesTable";
import { ordenarFifo } from "@/lib/domain/fifoVencimiento";
import type { FacturaCobroCandidata, RenglonCobro } from "@/features/facturacion/services/pagoClienteLote";

interface Props {
  facturas: FacturaCobroCandidata[];
  renglones: RenglonCobro[];
  moneda: string;
  /** Error puntual por factura (importe mayor al saldo). */
  erroresRenglon?: Record<string, string>;
  /** Facturas PPD timbradas: exigen complemento de pago. */
  idsConRep?: string[];
  onMontoChange: (facturaId: string, monto: number) => void;
  onAsignarSaldo: (facturaId: string) => void;
}

export function DialogCobroLoteRenglones(p: Props) {
  const montoDe = (id: string) => p.renglones.find((r) => r.factura_id === id)?.monto ?? 0;
  // BL-17: el orden mostrado debe ser EXACTAMENTE el del reparto real
  // (vencimiento → emisión → id). Antes se ordenaba a mano sólo por
  // vencimiento y la vista previa podía no coincidir con lo aplicado.
  const orden = ordenarFifo(p.facturas);


  return (
    <LoteRenglonesTable>

          {orden.map((f, i) => (
            <CobroLoteRenglon
              key={f.factura_id}
              factura={f}
              monto={montoDe(f.factura_id)}
              moneda={p.moneda}
              impar={i % 2 === 1}
              error={p.erroresRenglon?.[f.factura_id]}
              requiereRep={!!p.idsConRep?.includes(f.factura_id)}
              onMontoChange={(n) => p.onMontoChange(f.factura_id, n)}
              onAsignarSaldo={() => p.onAsignarSaldo(f.factura_id)}
            />
          ))}
    </LoteRenglonesTable>
  );
}
