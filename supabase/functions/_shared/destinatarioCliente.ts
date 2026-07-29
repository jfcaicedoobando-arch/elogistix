/**
 * M8 (auditoría arquitectura 2026-07-29, S5-10)
 * Validación de destinatarios de correo con datos financieros del tenant.
 *
 * Antes, un destinatario explícito enviado en el body se usaba tal cual, así que
 * cualquier miembro (incluido un `viewer`) podía enviar estados de cuenta,
 * recordatorios o cotizaciones a correos arbitrarios desde el dominio de la
 * plataforma (phishing creíble con datos reales).
 *
 * Regla: un destinatario explícito debe pertenecer al cliente — estar en
 * `contactos_cliente.email` o ser `clientes.email` (comparación case-insensitive).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const DESTINATARIO_NO_PERMITIDO = 'DESTINATARIO_NO_PERMITIDO';

/** Devuelve el set de correos autorizados (lowercase) para un cliente. */
export async function emailsPermitidosCliente(
  adminClient: SupabaseClient,
  clienteId: string,
): Promise<Set<string>> {
  const [contactos, clienteRow] = await Promise.all([
    adminClient
      .from('contactos_cliente')
      .select('email')
      .eq('cliente_id', clienteId)
      .not('email', 'is', null),
    adminClient.from('clientes').select('email').eq('id', clienteId).maybeSingle(),
  ]);

  const filas: { email?: string | null }[] = [
    ...((contactos.data ?? []) as { email?: string | null }[]),
    ...(clienteRow.data ? [clienteRow.data as { email?: string | null }] : []),
  ];

  return new Set(
    filas.map((r) => (r.email ?? '').trim().toLowerCase()).filter((e) => e.length > 0),
  );
}

/** `true` si el correo pertenece al cliente (contactos o correo principal). */
export async function emailPerteneceACliente(
  adminClient: SupabaseClient,
  clienteId: string,
  email: string,
): Promise<boolean> {
  const permitidos = await emailsPermitidosCliente(adminClient, clienteId);
  return permitidos.has(email.trim().toLowerCase());
}
