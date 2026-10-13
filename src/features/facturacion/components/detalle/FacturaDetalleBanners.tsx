import { esFacturaVigenteParaOperar } from "../../domain/facturaVigencia";
import { FacturaSaldoResidualAlert } from "./FacturaSaldoResidualAlert";
/**
 * FacturaDetalleBanners — avisos superiores del detalle de factura
 * (claim pendiente, cancelación en trámite, sustituta cancelada).
 * Extraído de `FacturaDetalleView` para bajar su complejidad.
 */
import { ClaimPendingBanner } from "@/features/facturacion/components/detalle/ClaimPendingBanner";
import { CancelacionEnTramiteBanner } from "@/features/facturacion/components/detalle/CancelacionEnTramiteBanner";
import { SustitutaCanceladaBanner } from "@/features/facturacion/components/detalle/SustitutaCanceladaBanner";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import type { FacturaDetalle } from "@/features/facturacion/services/detail";

const CANCELACION_EN_TRAMITE = ["pending", "verifying"];

interface Props {
  factura: FacturaDetalle;
  /** P1: la lectura de pagos y/o notas de crédito aplicadas falló. */
  saldoError?: boolean;
  saldo?: number;
  totalPagado?: number;
  onRetrySaldo?: () => void;
}

export function FacturaDetalleBanners({ factura, saldoError, onRetrySaldo, saldo = 0, totalPagado = 0 }: Props) {
  const cancellationStatus = factura.cancellation_status ?? null;
  const enTramite = CANCELACION_EN_TRAMITE.includes(cancellationStatus ?? "");
  const sustitutaCancelada =
    Boolean(factura.sustituida_por) && factura.sustituida_por_ref?.estado === "Cancelada";

  return (
    <>
      <AvisoFacturaHistorica factura={factura} />
      {saldoError && (
        <ErrorStateInline
          title="No pudimos verificar el saldo de esta factura"
          message="Falló la lectura de pagos o notas de crédito. Por seguridad se deshabilitaron registrar pago y crear notas de crédito hasta reintentar."
          onRetry={onRetrySaldo}
          className="py-4"
        />
      )}
      {!saldoError && <FacturaSaldoResidualAlert saldo={saldo} pagado={totalPagado}
        estado={factura.estado} metodoPago={factura.metodo_pago} moneda={factura.moneda} />}
      <ClaimPendingBanner
        soloLectura={!esFacturaVigenteParaOperar(factura)}
        facturaId={factura.id}
        facturapiId={factura.facturapi_id ?? null}
        facturapiClaimAt={factura.facturapi_claim_at ?? null}
      />
      {enTramite && <CancelacionEnTramiteBanner estado={cancellationStatus!} />}
      {sustitutaCancelada && factura.sustituida_por && (
        <SustitutaCanceladaBanner
          sustitutaId={factura.sustituida_por}
          sustitutaNumero={factura.sustituida_por_ref?.numero ?? null}
        />
      )}
    </>
  );
}

function AvisoFacturaHistorica({ factura }: { factura: FacturaDetalle }) {
  if (esFacturaVigenteParaOperar(factura)) return null;
  return (
    <p role="status" className="text-body text-muted-foreground">
      {factura.deleted_at ? "Factura dada de baja." : "No se pudo verificar la vigencia de esta factura."}
      {" "}Consulta histórica disponible; operaciones deshabilitadas.
    </p>
  );
}
