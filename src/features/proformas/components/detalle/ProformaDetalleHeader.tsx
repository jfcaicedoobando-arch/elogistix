/**
 * Header de la vista de detalle de proforma. Usa el componente canónico
 * `DetailHeader` (v13.320.66): botón Volver + número + badges de estado +
 * total destacado como acción trailing.
 */
import { FileText } from "lucide-react";
import { DetailHeader } from "@/components/shared/DetailHeader";
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
    <DetailHeader
      backTo="/proformas"
      backLabel="Volver a Proformas"
      icon={<FileText className="h-6 w-6 text-accent shrink-0" />}
      title={<span className="font-mono tabular-nums">{numero}</span>}
      badge={
        <EstadoBadges
          estadoProforma={estadoProforma}
          estadoCliente={estadoCliente}
          aceptadaPor={aceptadaPor}
        />
      }
      subtitle={
        <>
          {subtitulo}
          <span className="mx-1.5">•</span>
          Exp: <span className="font-mono">{expediente}</span>
        </>
      }
      trailing={totales ? <TotalDestacado totales={totales} /> : undefined}
    />
  );
}

