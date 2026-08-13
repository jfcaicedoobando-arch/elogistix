/**
 * Ola 3 / Ola 4 — Semáforo del expediente del proveedor. Ahora es un envoltorio
 * delgado del componente compartido, para que cliente y proveedor se vean igual.
 */
import { ExpedienteResumenCard } from "@/features/expediente/components/ExpedienteResumenCard";
import type {
  ResumenExpediente,
  TipoDocumentoProveedor,
} from "@/features/proveedor/domain/documentosProveedor";

interface Props {
  resumen: ResumenExpediente;
  onAgregar?: (tipo: TipoDocumentoProveedor) => void;
}

export function ProveedorExpedienteCard({ resumen, onAgregar }: Props) {
  return (
    <ExpedienteResumenCard
      titulo="Expediente del proveedor"
      resumen={resumen}
      onAgregar={onAgregar ? (tipo) => onAgregar(tipo as TipoDocumentoProveedor) : undefined}
    />
  );
}
