/**
 * Campos del pago a proveedor que el usuario tocó a mano.
 *
 * El T/C, la diferencia cambiaria y la cuenta bancaria se PRECARGAN solos
 * (DOF del día, sugerencia y preselección de cuenta). Comparar su valor contra
 * el baseline marcaría "cambios sin guardar" sólo por abrir el formulario, así
 * que el aviso de descarte sólo los considera cuando hubo captura real.
 */
import { useCallback, useEffect, useState } from "react";

export interface CamposTocadosPago {
  tc: boolean;
  diffMxn: boolean;
  cuentaId: boolean;
}

const VACIO: CamposTocadosPago = { tc: false, diffMxn: false, cuentaId: false };

export function useCamposTocadosPago(open: boolean, pagoEditarId: string | null) {
  const [tocados, setTocados] = useState<CamposTocadosPago>(VACIO);

  useEffect(() => {
    setTocados(VACIO);
  }, [open, pagoEditarId]);

  const marcar = useCallback((campo: keyof CamposTocadosPago) => {
    setTocados((t) => (t[campo] ? t : { ...t, [campo]: true }));
  }, []);

  return { tocados, marcar };
}
