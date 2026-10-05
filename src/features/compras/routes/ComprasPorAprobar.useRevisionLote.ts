import { useState } from "react";
import { resumirSeleccionEfectiva, type useSeleccionEfectiva } from "./ComprasPorAprobar.seleccion";
import type { useAprobarFacturasLote } from "@/features/cxp/hooks";

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
    const resultado = await aprobar(revisionLote.ids, {
      justificacion: justificacionLote,
      requierenJustificacion: revisionLote.idsSinEmbarque,
      versionesRevisadas: new Map(revisionLote.filas.map((f) => [f.id, f.updated_at])),
    });
    if (resultado.fallos.length > 0) {
      const fallidas = new Set(resultado.fallos.map((f) => f.id));
      setRevisionLote(resumirSeleccionEfectiva(revisionLote.filas.filter((f) => fallidas.has(f.id))));
      return;
    }
    limpiarSeleccion();
    setJustificacionLote("");
    setConfirmOpen(false);
  };
  return { confirmOpen, setConfirmOpen, justificacionLote, setJustificacionLote,
    confirmacion: revisionLote ?? seleccion, abrir, confirmar };
}
