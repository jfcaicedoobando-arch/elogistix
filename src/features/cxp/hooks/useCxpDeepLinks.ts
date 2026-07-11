/**
 * Deep-links de /compras/facturas.
 *
 * Encapsula dos efectos:
 *  - `?factura={id}` → abre el modal de detalle si la factura ya cargó.
 *  - `?aprobacion=pendiente|aprobada|rechazada` → activa el chip inicial.
 *
 * En ambos casos, tras aplicar el efecto se limpia el query param con
 * `replace: true` para no ensuciar el historial.
 */
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { FacturaCxP } from "@/features/cxp/services";

type AprobacionValor = "pendiente" | "aprobada" | "rechazada";

export interface UseCxpDeepLinksArgs {
  data: FacturaCxP[];
  isLoading: boolean;
  onOpenDetalle: (fact: FacturaCxP) => void;
  onSetAprobacion: (valor: AprobacionValor) => void;
}

export function useCxpDeepLinks({
  data,
  isLoading,
  onOpenDetalle,
  onSetAprobacion,
}: UseCxpDeepLinksArgs): void {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const id = searchParams.get("factura");
    if (!id || isLoading) return;
    const found = data.find((row) => row.id === id);
    if (!found) return;
    onOpenDetalle(found);
    setSearchParams(
      (sp) => {
        const next = new URLSearchParams(sp);
        next.delete("factura");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, data, isLoading, onOpenDetalle, setSearchParams]);

  // Efecto de mount-only: aplica el chip inicial de aprobación desde el query
  // param una sola vez. Refs para leer valores actuales sin re-suscribir.
  const onSetAprobacionRef = useRef(onSetAprobacion);
  const setSearchParamsRef = useRef(setSearchParams);
  const searchParamsRef = useRef(searchParams);
  onSetAprobacionRef.current = onSetAprobacion;
  setSearchParamsRef.current = setSearchParams;
  searchParamsRef.current = searchParams;

  useEffect(() => {
    const ap = searchParamsRef.current.get("aprobacion");
    if (ap === "pendiente" || ap === "aprobada" || ap === "rechazada") {
      onSetAprobacionRef.current(ap);
      setSearchParamsRef.current(
        (sp) => {
          const next = new URLSearchParams(sp);
          next.delete("aprobacion");
          return next;
        },
        { replace: true },
      );
    }
  }, []);
}
