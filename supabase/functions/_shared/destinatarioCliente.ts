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
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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

/** Extrae el dominio (lowercase) de un correo; null si no tiene '@' útil. */
export function dominioDeEmail(email: string): string | null {
  const limpio = email.trim().toLowerCase();
  const idx = limpio.lastIndexOf('@');
  return idx > 0 && idx < limpio.length - 1 ? limpio.slice(idx + 1) : null;
}

/**
 * R2 seguridad · P1 — Allowlist de destinatarios para documentos fiscales.
 * Un destinatario es "propio" si:
 *  1) pertenece a los contactos del cliente del documento (M8), o
 *  2) su dominio está en `dominiosOrg` (dominio corporativo de la org —
 *     típicamente el dominio del correo del caller, para copias internas).
 * Devuelve la lista de correos AJENOS (vacía = todos propios).
 *
 * Política de uso (decisión de producto): el resultado NO se bloquea de forma
 * ciega. Los flujos financieros de escritura pueden enviar a terceros
 * legítimos (agente aduanal, contador externo) y lo asientan en bitácora; los
 * roles de sólo lectura sí quedan bloqueados.
 */
export async function destinatariosNoPermitidos(
  adminClient: SupabaseClient,
  clienteId: string | null,
  emails: readonly string[],
  dominiosOrg: readonly string[],
): Promise<string[]> {
  const permitidos = clienteId
    ? await emailsPermitidosCliente(adminClient, clienteId)
    : new Set<string>();
  const dominios = new Set(
    dominiosOrg.map((d) => d.trim().toLowerCase()).filter((d) => d.length > 0),
  );
  return emails.filter((e) => {
    const limpio = e.trim().toLowerCase();
    if (permitidos.has(limpio)) return false;
    const dom = dominioDeEmail(limpio);
    return !(dom && dominios.has(dom));
  });
}
