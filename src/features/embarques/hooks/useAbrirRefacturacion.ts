/**
 * Al llegar desde «Refacturar desde esta proforma», abre «Generar proforma»
 * en cuanto los conceptos liberados aparecen como elegibles, con la nota de
 * linaje precargada. El estado de navegación se consume una sola vez.
 */
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { leerRefacturacionNavState } from "@/features/proformas/services/refacturar";
import type { Tables } from "@/types/db";

interface Params {
  canEdit: boolean;
  conceptosElegibles: Tables<"conceptos_venta">[];
  abrir: (notas: string) => void;
}

export function useAbrirRefacturacion({ canEdit, conceptosElegibles, abrir }: Params) {
  const location = useLocation();
  const navigate = useNavigate();
  const pendiente = leerRefacturacionNavState(location.state);

  useEffect(() => {
    if (!pendiente || !canEdit) return;
    const elegibles = new Set(conceptosElegibles.map((c) => c.id));
    if (!pendiente.conceptoIds.every((id) => elegibles.has(id))) return;
    abrir(pendiente.notas);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [pendiente, canEdit, conceptosElegibles, abrir, navigate, location.pathname, location.search]);
}
