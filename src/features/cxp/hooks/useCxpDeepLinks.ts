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
import { useEffect } from "react";
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

  useEffect(() => {
    const ap = searchParams.get("aprobacion");
    if (ap === "pendiente" || ap === "aprobada" || ap === "rechazada") {
      onSetAprobacion(ap);
      setSearchParams(
        (sp) => {
          const next = new URLSearchParams(sp);
          next.delete("aprobacion");
          return next;
        },
        { replace: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
