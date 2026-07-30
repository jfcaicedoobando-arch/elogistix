/**
 * Sección "Proveedor y datos fiscales" de la factura de proveedor (lectura).
 * v13.350.0 — Los adjuntos del CFDI se movieron a la pestaña "Documentos"
 * (`DocumentosProveedorSection`) para dar paridad con facturas emitidas.
 */
import { useVerificarUuidSat } from "@/features/cxp/hooks/useVerificarUuidSat";
import { ProgramacionPagoRow } from "@/features/cxp/components/ProgramacionPagoRow";
import { CanceladaBanner } from "./InfoFacturaSection.parts";
import { formatFechaHora } from "@/lib/formatters";
import {
  FechasCreditoBlock, DesgloseFiscalBlock, ReferenciasFiscalesBlock,
} from "./InfoFacturaSection.blocks";
import type { FacturaCxP } from "@/features/cxp/services";

interface Props {
  factura: FacturaCxP;
  /** Se conserva por compatibilidad: la edición vive en otras pestañas. */
  canEdit?: boolean;
}

export function InfoFacturaSection({ factura: f }: Props) {
  const verificar = useVerificarUuidSat();
  const estaCancelada = f.estado === "Cancelada";
  const verifDate = f.uuid_verificado_fecha
    ? formatFechaHora(f.uuid_verificado_fecha)
    : null;


  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-primary">
          Información de la factura
        </h3>
      </div>

      {estaCancelada && (
        <CanceladaBanner fecha={f.fecha_cancelacion} motivo={f.motivo_cancelacion} />
      )}

      <FechasCreditoBlock f={f} />
      <DesgloseFiscalBlock f={f} />
      <ReferenciasFiscalesBlock
        f={f}
        verifDate={verifDate}
        isVerifying={verificar.isPending}
        onVerify={() => verificar.mutate(f.id)}
      />

      <div className="space-y-2 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Programación de pago</h4>
        <ProgramacionPagoRow
          facturaId={f.id}
          fechaProgramada={f.fecha_programada_pago}
          saldo={f.saldo}
        />
      </div>

      {f.notas && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Notas</h4>
          <p className="text-sm text-foreground whitespace-pre-wrap rounded-md border bg-muted/30 p-3">
            {f.notas}
          </p>
        </div>
      )}
    </section>
  );
}
