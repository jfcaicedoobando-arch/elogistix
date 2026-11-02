import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import { emailPerteneceACliente } from './destinatarioCliente.ts';

/** Misma política del envío: primer contacto con correo, por antigüedad. */
export async function resolveDestinatarioRecordatorio(
  adminClient: SupabaseClient,
  clienteId: string,
  contactoEmail?: string | null,
): Promise<string | null> {
  if (contactoEmail) {
    const permitido = await emailPerteneceACliente(adminClient, clienteId, contactoEmail);
    return permitido ? contactoEmail : null;
  }

  const { data, error } = await adminClient
    .from('contactos_cliente')
    .select('email')
    .eq('cliente_id', clienteId)
    .not('email', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.email ?? null;
}
