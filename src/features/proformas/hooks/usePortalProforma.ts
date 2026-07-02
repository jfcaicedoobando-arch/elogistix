/**
 * Hook: portal público de proformas. Sin auth.
 */
import { useCallback, useEffect, useState } from "react";
import {
  fetchPortalProforma,
  responderPortalProforma,
  type PortalProformaResponse,
} from "@/features/proformas/services/portalPublico";

interface State {
  loading: boolean;
  error: string | null;
  data: PortalProformaResponse | null;
}

export function usePortalProforma(token: string | undefined) {
  const [state, setState] = useState<State>({ loading: true, error: null, data: null });
  const [submitting, setSubmitting] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) {
      setState({ loading: false, error: "Enlace inválido", data: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetchPortalProforma(token);
      setState({ loading: false, error: null, data });
    } catch (e) {
      setState({ loading: false, error: (e as Error).message, data: null });
    }
  }, [token]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!alive) return;
      await cargar();
    })();
    return () => {
      alive = false;
    };
  }, [cargar]);

  const responder = useCallback(
    async (respuesta: "aceptada" | "rechazada", motivo: string) => {
      if (!token) throw new Error("Enlace inválido");
      setSubmitting(true);
      try {
        await responderPortalProforma(token, respuesta, motivo);
        await cargar();
      } finally {
        setSubmitting(false);
      }
    },
    [token, cargar],
  );

  return { ...state, submitting, responder, recargar: cargar };
}
