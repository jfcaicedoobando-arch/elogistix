/**
 * Servicio: obtiene los contactos + email del cliente para elegir
 * destinatario al enviar un CFDI. Extraído para respetar la regla
 * hooks → services → supabase client.
 */
import { supabase } from "@/integrations/supabase/client";

const TIPOS_FACTURACION = [
  "facturacion",
  "facturación",
  "cobranza",
  "contabilidad",
  "pagador",
  "administracion",
  "administración",
];

export interface ContactoEnvio {
  id: string;
  nombre: string | null;
  email: string;
  tipo: string | null;
  esFacturacion: boolean;
}

export interface DatosEnvioCliente {
  contactos: ContactoEnvio[];
  emailCliente: string | null;
  emailSugerido: string | null;
}

export async function fetchContactosClienteEnvio(
  clienteId: string,
): Promise<DatosEnvioCliente> {
  const [contactosRes, clienteRes] = await Promise.all([
    supabase
      .from("contactos_cliente")
      .select("id, nombre, email, tipo, created_at")
      .eq("cliente_id", clienteId)
      .is("deleted_at", null)
      .not("email", "is", null)
      .order("created_at", { ascending: false }),
    supabase.from("clientes").select("email").eq("id", clienteId).maybeSingle(),
  ]);

  const contactos: ContactoEnvio[] = (
    (contactosRes.data ?? []) as Array<{
      id: string;
      nombre: string | null;
      email: string | null;
      tipo: string | null;
    }>
  )
    .filter((c) => c.email && c.email.includes("@"))
    .map((c) => {
      const t = (c.tipo ?? "").toLowerCase().trim();
      return {
        id: c.id,
        nombre: c.nombre,
        email: c.email as string,
        tipo: c.tipo,
        esFacturacion: TIPOS_FACTURACION.some((k) => t.includes(k)),
      };
    })
    .sort((a, b) => Number(b.esFacturacion) - Number(a.esFacturacion));

  const emailCliente = (clienteRes.data?.email as string | null) ?? null;
  // Orden de preferencia: contacto de facturación/cobranza > email fiscal del
  // cliente > cualquier otro contacto. El email del cliente va ANTES de un
  // contacto de otro tipo (exportador, shipper, operativo): antes se sugería el
  // contacto más reciente y un CFDI podía dirigirse al exportador del cliente.
  const emailSugerido =
    contactos.find((c) => c.esFacturacion)?.email ??
    emailCliente ??
    contactos[0]?.email ??
    null;


  return { contactos, emailCliente, emailSugerido };
}
