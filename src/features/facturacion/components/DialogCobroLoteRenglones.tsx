/**
 * Tabla de reparto del cobro en lote de cliente.
 * Separada del diálogo para respetar el límite de 200 líneas por componente.
 */
import { CobroLoteRenglon } from "./CobroLoteRenglon";
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
  // El reparto es FIFO: se muestran en el mismo orden en que se aplica.
  const orden = [...p.facturas].sort((a, b) =>
    (a.fecha_vencimiento ?? "9999-12-31").localeCompare(b.fecha_vencimiento ?? "9999-12-31"),
  );

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[660px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="w-[18%] px-3 py-2 text-left font-medium">Factura</th>
            <th className="w-[16%] px-3 py-2 text-left font-medium">Vence</th>
            <th className="w-[18%] px-3 py-2 text-right font-medium">Saldo</th>
            <th className="w-[26%] px-3 py-2 text-right font-medium">Se aplica</th>
            <th className="w-[22%] px-3 py-2 text-right font-medium">Queda</th>
          </tr>
        </thead>
        <tbody>
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
        </tbody>
      </table>
    </div>
  );
}
