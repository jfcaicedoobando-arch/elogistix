/**
 * useContactosClienteParaEnvio — Obtiene los contactos + email del cliente
 * para elegir destinatario al enviar un CFDI. Ordena preferentemente los
 * contactos de facturación/cobranza primero.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TIPOS_FACTURACION = ["facturacion", "facturación", "cobranza", "contabilidad", "pagador", "administracion", "administración"];

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

async function fetchContactos(clienteId: string): Promise<DatosEnvioCliente> {
  const [contactosRes, clienteRes] = await Promise.all([
    supabase
      .from("contactos_cliente")
      .select("id, nombre, email, tipo, created_at")
      .eq("cliente_id", clienteId)
      .is("deleted_at", null)
      .not("email", "is", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("clientes")
      .select("email")
      .eq("id", clienteId)
      .maybeSingle(),
  ]);

  const contactos: ContactoEnvio[] = ((contactosRes.data ?? []) as Array<{
    id: string; nombre: string | null; email: string | null; tipo: string | null;
  }>)
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
  const emailSugerido =
    contactos.find((c) => c.esFacturacion)?.email ??
    contactos[0]?.email ??
    emailCliente ??
    null;

  return { contactos, emailCliente, emailSugerido };
}

export function useContactosClienteParaEnvio(clienteId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["contactos-cliente-envio", clienteId],
    queryFn: () => fetchContactos(clienteId!),
    enabled: enabled && Boolean(clienteId),
    staleTime: 60_000,
  });
}
