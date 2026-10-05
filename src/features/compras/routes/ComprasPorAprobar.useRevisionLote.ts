import { useState } from "react";
import type { useSeleccionEfectiva } from "./ComprasPorAprobar.seleccion";
import type { useAprobarFacturasLote } from "@/features/cxp/hooks/useAprobarFacturasLote";

/** La confirmación conserva exactamente la selección y versiones que se mostraron. */
export function useRevisionLote(
  seleccion: ReturnType<typeof useSeleccionEfectiva>,
  aprobar: ReturnType<typeof useAprobarFacturasLote>["aprobar"],
  limpiarSeleccion: () => void,
) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [justificacionLote, setJustificacionLote] = useState("");
  const [revisionLote, setRevisionLote] = useState<typeof seleccion | null>(null);
  const abrir = () => {
    if (seleccion.filas.length === 0) return;
    setRevisionLote(seleccion);
    setConfirmOpen(true);
  };
  const confirmar = async () => {
    if (!revisionLote || revisionLote.ids.length === 0) {
      setConfirmOpen(false);
      return;
    }
    await aprobar(revisionLote.ids, {
      justificacion: justificacionLote,
      requierenJustificacion: revisionLote.idsSinEmbarque,
      versionesRevisadas: new Map(revisionLote.filas.map((f) => [f.id, f.updated_at])),
    });
    limpiarSeleccion();
    setJustificacionLote("");
    setConfirmOpen(false);
  };
  return { confirmOpen, setConfirmOpen, justificacionLote, setJustificacionLote,
    confirmacion: revisionLote ?? seleccion, abrir, confirmar };
}
