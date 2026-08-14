/**
 * FacturaDetalleBanners — avisos superiores del detalle de factura
 * (claim pendiente, cancelación en trámite, sustituta cancelada).
 * Extraído de `FacturaDetalleView` para bajar su complejidad.
 */
import { ClaimPendingBanner } from "@/features/facturacion/components/detalle/ClaimPendingBanner";
import { CancelacionEnTramiteBanner } from "@/features/facturacion/components/detalle/CancelacionEnTramiteBanner";
import { SustitutaCanceladaBanner } from "@/features/facturacion/components/detalle/SustitutaCanceladaBanner";
import type { FacturaDetalle } from "@/features/facturacion/services/detail";

const CANCELACION_EN_TRAMITE = ["pending", "verifying"];

export function FacturaDetalleBanners({ factura }: { factura: FacturaDetalle }) {
  const cancellationStatus = factura.cancellation_status ?? null;
  const enTramite = CANCELACION_EN_TRAMITE.includes(cancellationStatus ?? "");
  const sustitutaCancelada =
    Boolean(factura.sustituida_por) && factura.sustituida_por_ref?.estado === "Cancelada";

  return (
    <>
      <ClaimPendingBanner
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
