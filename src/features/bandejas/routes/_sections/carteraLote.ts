/**
 * Derivación del lote de cobro a partir de la selección en Cartera.
 * Regla: mismo cliente, misma moneda y al menos dos facturas.
 */
import type { CarteraRow } from "./carteraColumns";
import type { FacturaCobroCandidata } from "@/features/facturacion/services/pagoClienteLote";

export interface LoteCobroSeleccion {
  clienteId: string;
  clienteNombre: string;
  moneda: string;
  facturas: FacturaCobroCandidata[];
}

export function derivarLoteCobro(seleccionadas: CarteraRow[]): LoteCobroSeleccion | null {
  if (seleccionadas.length < 2) return null;
  const primera = seleccionadas[0];
  const mismoCliente = seleccionadas.every((r) => r.cliente_id === primera.cliente_id);
  const mismaMoneda = seleccionadas.every((r) => r.moneda === primera.moneda);
  if (!mismoCliente || !mismaMoneda || !primera.cliente_id) return null;
  return {
    clienteId: primera.cliente_id,
    clienteNombre: primera.cliente_nombre ?? "",
    moneda: primera.moneda,
    facturas: seleccionadas.map((r) => ({
      factura_id: r.factura_id,
      numero: r.numero,
      fecha_vencimiento: r.fecha_vencimiento,
      saldo: Number(r.saldo ?? 0),
    })),
  };
}
