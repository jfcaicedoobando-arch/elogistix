import { useMemo } from "react";
import { useCreateTrackingLink, useDeleteTrackingLink, useTrackingLinks } from "@/features/embarques/hooks/useTrackingLinks";
import { esTrackingLinkVigente, fetchTrackingLinks, TRACKING_LINK_VIGENCIA_DIAS } from "@/features/embarques/services/tracking";
import type { Tables } from "@/integrations/supabase/types";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
/**
 * Encapsula la creación/reuso, revocación y copiado al portapapeles del
 * enlace público de tracking para un embarque dado.
 *
 * Reglas (fix3 — antes cada clic creaba una liga NUEVA y eterna):
 *  - "Compartir" reutiliza la liga vigente del embarque si existe.
 *  - Las ligas nuevas nacen con vigencia de TRACKING_LINK_VIGENCIA_DIAS días
 *    (alineado con la vigencia de los enlaces de proforma: 30 días).
 *  - Las ligas legacy sin expires_at (eternas) no se reutilizan; se pueden
 *    revocar con "Revocar liga de tracking".
 */
export function useEmbarqueDetalleTracking(embarqueId: string | undefined) {
  const createTrackingLink = useCreateTrackingLink();
  const deleteTrackingLink = useDeleteTrackingLink();
  const linksQuery = useTrackingLinks(embarqueId);

  const linkActivo = useMemo(
    () => (linksQuery.data ?? []).find((l) => esTrackingLinkVigente(l)) ?? null,
    [linksQuery.data],
  );

  const handleCompartirTracking = async () => {
    if (!embarqueId) return;
    try {
      // Re-consulta fresca: la cache puede estar vieja si otro usuario creó
      // una liga hace un momento. Reusar evita acumular tokens vivos.
      const links = await fetchTrackingLinks(embarqueId);
      let link: Tables<"tracking_links"> | null = links.find((l) => esTrackingLinkVigente(l)) ?? null;
      if (!link) {
        const expiresAt = new Date(
          Date.now() + TRACKING_LINK_VIGENCIA_DIAS * 24 * 60 * 60 * 1000,
        ).toISOString();
        link = await createTrackingLink.mutateAsync({ embarqueId, expiresAt });
      }
      const url = `${window.location.origin}/tracking/${link.token}`;
      await navigator.clipboard.writeText(url);
      notifySuccess(undefined, { title: "Enlace copiado", description: "El enlace de tracking fue copiado al portapapeles." });
    } catch {
      notifyError(undefined, { title: "Error al generar enlace", method: "HANDLE_COMPARTIR_TRACKING", errorCode: ERROR_CODES.VALIDATION_FAILED });
    }
  };

  const handleRevocarTracking = async () => {
    if (!embarqueId || !linkActivo) return;
    try {
      await deleteTrackingLink.mutateAsync({ linkId: linkActivo.id, embarqueId });
    } catch {
      // el onError de la mutación ya notifica
    }
  };

  return {
    handleCompartirTracking,
    handleRevocarTracking,
    tieneLinkActivo: linkActivo !== null,
    isPending: createTrackingLink.isPending || deleteTrackingLink.isPending,
  };
}
