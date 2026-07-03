/**
 * Header de la vista de detalle de proforma. Alineado con
 * `FacturaDetalleHeader`: número + estado + subtítulo cliente/expediente
 * a la izquierda y total destacado a la derecha, sin `Card` wrapper.
 */
import { EstadoBadges, TotalDestacado } from "@/features/proformas/components/ProformaDetalleCards";
import type { calcularTotalesProforma } from "@/features/proformas/domain/proforma";
import type { EstadoClienteProforma } from "@/features/proformas/domain/proformaClienteEstado";

type Totales = ReturnType<typeof calcularTotalesProforma>;

interface Props {
  numero: string;
  estadoProforma: string;
  estadoCliente: EstadoClienteProforma;
  aceptadaPor: string | null;
  clienteNombre: string | null | undefined;
  expediente: string;
  totales: Totales | null;
}

export function ProformaDetalleHeader({
  numero,
  estadoProforma,
  estadoCliente,
  aceptadaPor,
  clienteNombre,
  expediente,
  totales,
}: Props) {
  const subtitulo = clienteNombre?.trim() || "";
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold font-mono tabular-nums">{numero}</h1>
          <EstadoBadges
            estadoProforma={estadoProforma}
            estadoCliente={estadoCliente}
            aceptadaPor={aceptadaPor}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-1 truncate" title={subtitulo}>
          {subtitulo}
          <span className="mx-1.5">•</span>
          Exp: <span className="font-mono">{expediente}</span>
        </p>
      </div>
      {totales && <TotalDestacado totales={totales} />}
    </div>
  );
}
