import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';

export interface FacturaDestinatario {
  id: string;
  organization_id: string;
  cliente_id: string;
}

export interface DestinatarioConfirmado {
  organization_id: string;
  cliente_id: string;
  contacto_id: string;
  email: string;
}

export class RevisionDestinatarioError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

async function exigirClienteActivo(client: SupabaseClient, factura: FacturaDestinatario) {
  const { data, error } = await client.from('clientes').select('id')
    .eq('id', factura.cliente_id).eq('organization_id', factura.organization_id)
    .is('deleted_at', null).maybeSingle();
  if (error) throw error;
  if (!data) throw new RevisionDestinatarioError('CLIENTE_NO_DISPONIBLE',
    'El cliente ya no está disponible para enviar recordatorios. Revisa su ficha antes de continuar.');
}

/** Sólo recordatorios: misma antigüedad, excluyendo cliente y contactos de baja. */
export async function consultarDestinatarioRecordatorio(
  client: SupabaseClient, factura: FacturaDestinatario,
): Promise<DestinatarioConfirmado | null> {
  await exigirClienteActivo(client, factura);
  const { data, error } = await client.from('contactos_cliente').select('id, email')
    .eq('cliente_id', factura.cliente_id).eq('organization_id', factura.organization_id)
    .is('deleted_at', null).not('email', 'is', null)
    .order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data?.email) return null;
  return { organization_id: factura.organization_id, cliente_id: factura.cliente_id,
    contacto_id: data.id, email: data.email };
}

/** Valida identidad y correo actuales; nunca busca otra fila ni clientes.email. */
export async function validarDestinatarioConfirmado(
  client: SupabaseClient, factura: FacturaDestinatario, confirmado: DestinatarioConfirmado,
): Promise<string> {
  if (confirmado.cliente_id !== factura.cliente_id || confirmado.organization_id !== factura.organization_id) {
    throw new RevisionDestinatarioError('FACTURA_CAMBIO',
      'Cambió el cliente o la organización de la factura. Vuelve a consultar y revisa el destinatario.');
  }
  await exigirClienteActivo(client, factura);
  const { data, error } = await client.from('contactos_cliente').select('id, email')
    .eq('id', confirmado.contacto_id).eq('cliente_id', factura.cliente_id)
    .eq('organization_id', factura.organization_id).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  if (!data) throw new RevisionDestinatarioError('CONTACTO_NO_DISPONIBLE',
    'El contacto seleccionado ya no está disponible para este cliente. Vuelve a consultar y revisa el destinatario.');
  if (data.email !== confirmado.email) throw new RevisionDestinatarioError('DESTINATARIO_CAMBIO',
    'El correo del contacto cambió. Vuelve a consultar y revisa el destinatario antes de enviar.');
  return confirmado.email;
}
