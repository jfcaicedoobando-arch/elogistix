import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";

/** La mutación invalida la agenda; permanecer en ella conserva todos sus filtros. */
export function useVolverAgendaActividad() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return useCallback(() => {
    if (pathname.replace(/\/$/, "") !== "/crm/actividades") navigate("/crm/actividades");
  }, [pathname, navigate]);
}
