/** Recuperado de 0126f0f: abre el formulario normal, sin crear otra proforma. */
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { leerRefacturacionNavState, type RefacturarResultado } from "@/features/proformas";

interface Params {
  embarqueId: string;
  canEdit: boolean;
  conceptosElegibles: { id: string }[];
  abrir: (refacturacion: RefacturarResultado) => void;
}

export function useAbrirRefacturacion({ embarqueId, canEdit, conceptosElegibles, abrir }: Params) {
  const location = useLocation();
  const navigate = useNavigate();
  const consumida = useRef<string | null>(null);
  const pendiente = leerRefacturacionNavState(location.state);
  useEffect(() => {
    if (!pendiente || !canEdit || pendiente.embarque_id !== embarqueId) return;
    if (consumida.current === location.key) return;
    const elegibles = new Set(conceptosElegibles.map((c) => c.id));
    if (!pendiente.conceptos.every((id) => elegibles.has(id))) return;
    consumida.current = location.key;
    abrir(pendiente);
    // Consumir antes de volver/avanzar: cerrar el formulario no debe reabrirlo.
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [pendiente, canEdit, embarqueId, conceptosElegibles, abrir, navigate, location]);
}
