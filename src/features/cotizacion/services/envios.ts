/**
 * Servicio: lecturas del dominio "envíos de cotización" (historial + contactos).
 * Aísla el cliente Supabase de los hooks (regla de capas).
 */
import { supabase } from "@/integrations/supabase/client";

export interface EnvioRow {
  id: string;
  created_at: string;
  enviado_por: string | null;
  destinatarios: Array<{ email: string; nombre?: string }>;
  cc: string[];
  asunto: string | null;
  mensaje: string | null;
  estado: string;
  error: string | null;
  pdf_link_publico: string | null;
  pdf_storage_path: string | null;
}

export interface ContactoClienteEmail {
  id: string;
  nombre: string;
  contacto: string;
  email: string;
  tipo: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function fetchHistorialEnviosCotizacion(cotizacionId: string): Promise<EnvioRow[]> {
  const { data, error } = await supabase
    .from("cotizacion_envios")
    .select(
      "id, created_at, enviado_por, destinatarios, cc, asunto, mensaje, estado, error, pdf_link_publico, pdf_storage_path",
    )
    .eq("cotizacion_id", cotizacionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  // SAFE-CAST: columnas jsonb (destinatarios, cc) tipadas al shape contractual de EnvioRow.
  return (data ?? []) as unknown as EnvioRow[];
}

export const CLIENTE_PRINCIPAL_ID = "__cliente_principal__";

export async function fetchContactosClienteConEmail(
  clienteId: string,
): Promise<ContactoClienteEmail[]> {
  const [{ data: contactosData, error: errContactos }, { data: clienteData, error: errCliente }] =
    await Promise.all([
      supabase
        .from("contactos_cliente")
        .select("id, nombre, contacto, email, tipo")
        .eq("cliente_id", clienteId)
        .is("deleted_at", null),
      supabase.from("clientes").select("nombre, email").eq("id", clienteId).maybeSingle(),
    ]);
  if (errContactos) throw errContactos;
  if (errCliente) throw errCliente;

  const contactos = (contactosData ?? []).filter(
    (c) => c.email && EMAIL_RE.test(c.email),
  ) as ContactoClienteEmail[];

  const out: ContactoClienteEmail[] = [];
  const emailPrincipal = clienteData?.email?.trim();
  if (emailPrincipal && EMAIL_RE.test(emailPrincipal)) {
    out.push({
      id: CLIENTE_PRINCIPAL_ID,
      nombre: clienteData?.nombre ?? "",
      contacto: clienteData?.nombre ?? "",
      email: emailPrincipal,
      tipo: "Cliente",
    });
  }
  const principalLower = emailPrincipal?.toLowerCase();
  for (const c of contactos) {
    if (principalLower && c.email.toLowerCase() === principalLower) continue;
    out.push(c);
  }
  return out;
}

const PROVEEDOR_TIPO_RE = /(proveedor|exportador|shipper|fabric)/i;
const CLIENTE_PRIORIDAD_RE = /(cliente|cotiz|operativ|administ|cobran)/i;

export function esContactoProveedor(c: Pick<ContactoClienteEmail, "tipo">): boolean {
  return !!c.tipo && PROVEEDOR_TIPO_RE.test(c.tipo);
}

export function esContactoPrioridadCliente(c: Pick<ContactoClienteEmail, "tipo">): boolean {
  return !!c.tipo && CLIENTE_PRIORIDAD_RE.test(c.tipo);
}

