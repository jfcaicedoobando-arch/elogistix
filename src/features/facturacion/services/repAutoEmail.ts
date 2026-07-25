/**
 * Servicio: auto-envío del REP recién timbrado al contacto principal
 * del cliente. Extraído de useTimbrarRep para respetar la regla
 * hooks → services → supabase client.
 */
import { supabase } from "@/integrations/supabase/client";

export async function autoEnviarRepPorCorreo(pagoId: string): Promise<void> {
  const { data: pago, error: pagoErr } = await supabase
    .from("pagos_factura")
    .select("id, factura_id")
    .eq("id", pagoId)
    .maybeSingle();
  if (pagoErr || !pago?.factura_id) return;

  const { data: factura, error: factErr } = await supabase
    .from("facturas")
    .select("cliente_id")
    .eq("id", pago.factura_id)
    .maybeSingle();
  if (factErr || !factura?.cliente_id) return;

  const { data: contactos, error: cErr } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", factura.cliente_id)
    .not("email", "is", null)
    .is("deleted_at", null)
    .limit(1);
  if (cErr || !contactos || contactos.length === 0) return;
  const email = contactos[0]?.email;
  if (!email) return;

  await supabase.functions.invoke("facturapi-enviar-email", {
    body: { pago_id: pagoId, email },
  });
}
