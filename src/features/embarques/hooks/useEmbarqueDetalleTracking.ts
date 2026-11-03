import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCreateTrackingLink, useDeleteTrackingLink, useTrackingLinks } from "@/features/embarques/hooks/useTrackingLinks";
import { esTrackingLinkVigente, fetchTrackingLinks, TRACKING_LINK_VIGENCIA_DIAS } from "@/features/embarques/services/tracking";
import type { Tables } from "@/integrations/supabase/types";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

interface EnlaceCopiado {
  contexto: { embarqueId: string | undefined };
  embarqueId: string;
  linkId: string;
  expiresAt: string | null;
  avisoAbierto: boolean;
  revocado: boolean;
}

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
  const contexto = useMemo(() => ({ embarqueId }), [embarqueId]);
  const contextoActual = useRef<typeof contexto | null>(contexto);
  const copiaEnCurso = useRef<typeof contexto | null>(null);
  const [copiando, setCopiando] = useState<typeof contexto | null>(null);
  const [enlaceCopiado, setEnlaceCopiado] = useState<EnlaceCopiado | null>(null);
  const enlaceCopiadoActual = useRef<EnlaceCopiado | null>(null);
  const actualizarCopiado = (enlace: EnlaceCopiado) => {
    enlaceCopiadoActual.current = enlace;
    setEnlaceCopiado(enlace);
  };
  useLayoutEffect(() => {
    contextoActual.current = contexto;
    return () => { if (contextoActual.current === contexto) contextoActual.current = null; };
  }, [contexto]);

  const linkActivo = useMemo(
    () => (linksQuery.data ?? []).find((l) => l.embarque_id === embarqueId && esTrackingLinkVigente(l)) ?? null,
    [linksQuery.data, embarqueId],
  );
  const copiadoActual = enlaceCopiado?.contexto === contexto ? enlaceCopiado : null;
  // Cerrar el aviso o refrescar la caché no cambia el enlace que se promete revocar.
  // Una revocación exitosa tampoco debe sustituirlo silenciosamente por otro token.
  const objetivoRevocacion = copiadoActual
    ? (copiadoActual.revocado ? null : { linkId: copiadoActual.linkId, embarqueId: copiadoActual.embarqueId })
    : (linkActivo ? { linkId: linkActivo.id, embarqueId: linkActivo.embarque_id } : null);

  const handleCompartirTracking = async () => {
    if (!embarqueId || contextoActual.current !== contexto || copiaEnCurso.current === contexto) return;
    const esContextoActual = () => contextoActual.current === contexto;
    copiaEnCurso.current = contexto;
    setCopiando(contexto);
    try {
      // Re-consulta fresca: la cache puede estar vieja si otro usuario creó
      // una liga hace un momento. Reusar evita acumular tokens vivos.
      const links = await fetchTrackingLinks(embarqueId);
      if (!esContextoActual()) return;
      let link: Tables<"tracking_links"> | null = links.find((l) => esTrackingLinkVigente(l)) ?? null;
      if (!link) {
        const expiresAt = new Date(
          Date.now() + TRACKING_LINK_VIGENCIA_DIAS * 24 * 60 * 60 * 1000,
        ).toISOString();
        link = await createTrackingLink.mutateAsync({ embarqueId, expiresAt });
      }
      if (!esContextoActual()) return;
      if (link.embarque_id !== embarqueId) throw new Error("No se pudo confirmar el embarque del enlace.");
      const url = `${window.location.origin}/tracking/${link.token}`;
      await navigator.clipboard.writeText(url);
      if (!esContextoActual()) return;
      actualizarCopiado({ contexto, embarqueId, linkId: link.id, expiresAt: link.expires_at,
        avisoAbierto: true, revocado: false });
      notifySuccess(undefined, { title: "Enlace público copiado", description: "Revisa su alcance y vencimiento antes de enviarlo." });
    } catch (error) {
      if (!esContextoActual()) return;
      notifyError(undefined, { title: "Error al generar enlace", error,
        method: "HANDLE_COMPARTIR_TRACKING", context: { embarqueId } });
    } finally {
      if (copiaEnCurso.current === contexto) copiaEnCurso.current = null;
      setCopiando((actual) => actual === contexto ? null : actual);
    }
  };

  const handleRevocarTracking = async () => {
    if (!embarqueId || contextoActual.current !== contexto || copiaEnCurso.current === contexto) return;
    // También un callback retenido de un render anterior debe usar el ID ya copiado.
    const copiado = enlaceCopiadoActual.current?.contexto === contexto ? enlaceCopiadoActual.current : null;
    const objetivo = copiado
      ? (copiado.revocado ? null : { linkId: copiado.linkId, embarqueId: copiado.embarqueId })
      : (linkActivo ? { linkId: linkActivo.id, embarqueId: linkActivo.embarque_id } : null);
    if (!objetivo || objetivo.embarqueId !== embarqueId) return;
    try {
      await deleteTrackingLink.mutateAsync(objetivo);
      if (contextoActual.current !== contexto) return;
      const actual = enlaceCopiadoActual.current;
      if (actual?.contexto === contexto && actual.linkId === objetivo.linkId) {
        actualizarCopiado({ ...actual, revocado: true, avisoAbierto: false });
      }
    } catch {
      // el onError de la mutación ya notifica
    }
  };

  return {
    handleCompartirTracking,
    handleRevocarTracking,
    avisoEnlace: copiadoActual?.avisoAbierto && !copiadoActual.revocado ? { expiresAt: copiadoActual.expiresAt } : null,
    cerrarAvisoEnlace: () => {
      const actual = enlaceCopiadoActual.current;
      if (actual?.contexto === contexto) actualizarCopiado({ ...actual, avisoAbierto: false });
    },
    tieneLinkActivo: objetivoRevocacion !== null,
    isPending: copiando === contexto || createTrackingLink.isPending || deleteTrackingLink.isPending,
  };
}
