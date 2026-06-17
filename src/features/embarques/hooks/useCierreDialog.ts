/**
 * Orquesta los 4 estados de UI necesarios para los diálogos de cierre/reapertura
 * del Bloque S. Extraído de `TabCierre.tsx` en v13.56.3 (auditoría — paso 13).
 *
 * Mantiene el componente de UI ≤200 líneas y permite testear la lógica de
 * confirmación tipada y motivo mínimo sin renderizar el árbol completo.
 */
import { useCallback, useState } from "react";

export const CIERRE_CONFIRM_TEXT = "CERRAR";
export const CIERRE_MOTIVO_MIN = 20;

export interface UseCierreDialogResult {
  openCerrar: boolean;
  openReabrir: boolean;
  confirmText: string;
  motivoReapertura: string;
  setOpenCerrar: (v: boolean) => void;
  setOpenReabrir: (v: boolean) => void;
  setConfirmText: (v: string) => void;
  setMotivoReapertura: (v: string) => void;
  /** true cuando el texto escrito coincide exactamente con "CERRAR". */
  puedeConfirmarCerrar: boolean;
  /** true cuando el motivo (trim) tiene ≥20 caracteres. */
  puedeConfirmarReabrir: boolean;
  resetCerrar: () => void;
  resetReabrir: () => void;
}

export function useCierreDialog(): UseCierreDialogResult {
  const [openCerrar, setOpenCerrar] = useState(false);
  const [openReabrir, setOpenReabrir] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [motivoReapertura, setMotivoReapertura] = useState("");

  const puedeConfirmarCerrar = confirmText === CIERRE_CONFIRM_TEXT;
  const puedeConfirmarReabrir = motivoReapertura.trim().length >= CIERRE_MOTIVO_MIN;

  const resetCerrar = useCallback(() => {
    setOpenCerrar(false);
    setConfirmText("");
  }, []);

  const resetReabrir = useCallback(() => {
    setOpenReabrir(false);
    setMotivoReapertura("");
  }, []);

  return {
    openCerrar, openReabrir, confirmText, motivoReapertura,
    setOpenCerrar, setOpenReabrir, setConfirmText, setMotivoReapertura,
    puedeConfirmarCerrar, puedeConfirmarReabrir,
    resetCerrar, resetReabrir,
  };
}
