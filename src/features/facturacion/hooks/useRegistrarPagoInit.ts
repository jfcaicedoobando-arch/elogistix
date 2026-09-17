/**
 * FE-02: inicializa el formulario de pago una sola vez por apertura del diálogo
 * (open + factura.id) y genera el `clientRequestId` de idempotencia (BL-14).
 *
 * Extraído de `DialogRegistrarPago.tsx` (límite Power-of-10 de 200 líneas).
 */
import { useEffect, useRef, useState } from "react";
import { todayLocalISO } from "@/lib/date/today";
import type { PagoFormValues } from "@/features/facturacion/components/PagoFormFields";

export function useRegistrarPagoInit(
  open: boolean,
  factura: { id: string; moneda: string } | null,
  saldo: number,
  setValues: (v: PagoFormValues) => void,
) {
  // Antes las deps vivas (objeto factura nuevo en cada refetch, saldo derivado
  // de queries) re-ejecutaban el efecto y borraban lo capturado por el usuario.
  const initializedForRef = useRef<string | null>(null);
  const clientRequestIdRef = useRef<string | null>(null);
  // Baseline de "sin cambios": los valores con los que se abrió el formulario.
  const [baseline, setBaseline] = useState<PagoFormValues | null>(null);

  useEffect(() => {
    if (!open || !factura) {
      initializedForRef.current = null;
      clientRequestIdRef.current = null;
      setBaseline(null);
      return;
    }
    if (initializedForRef.current === factura.id) return;
    initializedForRef.current = factura.id;
    clientRequestIdRef.current = crypto.randomUUID();
    const iniciales: PagoFormValues = {
      fecha: todayLocalISO(),
      // EC-12: redondeo hacia ARRIBA al centavo. Con `toFixed` (al más cercano)
      // el prefill podía quedar 1 centavo por debajo del saldo y dejar un
      // residuo impagable (la factura nunca quedaba saldada).
      monto: saldo > 0 ? (Math.ceil((saldo - 1e-9) * 100) / 100).toFixed(2) : "",
      moneda: factura.moneda,
      formaPago: "03", referencia: "", notas: "", cuentaBancariaId: "",
    };
    setValues(iniciales);
    setBaseline(iniciales);
  }, [open, factura, saldo, setValues]);

  return { clientRequestIdRef, baseline };
}
