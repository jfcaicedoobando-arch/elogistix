/**
 * Cotizaciones — Conversión: Prospecto → Cliente.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface ProspectoAClienteInput {
  cotizacionId: string;
  clienteData: {
    nombre: string;
    contacto: string;
    email: string;
    telefono: string;
    rfc?: string;
    direccion?: string;
    ciudad?: string;
    estado?: string;
    cp?: string;
  };
  user: { id: string; email?: string | null } | null;
}

export async function convertirProspectoACliente(input: ProspectoAClienteInput) {
  const { cotizacionId, clienteData, user } = input;
  const { data: clienteCreado, error: errorCliente } = await supabase
    .from("clientes")
    .insert({
      nombre: clienteData.nombre,
      contacto: clienteData.contacto,
      email: clienteData.email,
      telefono: clienteData.telefono,
      rfc: clienteData.rfc || "",
      direccion: clienteData.direccion || "",
      ciudad: clienteData.ciudad || "",
      estado: clienteData.estado || "",
      cp: clienteData.cp || "",
    })
    .select()
    .single();
  if (errorCliente) throw errorCliente;

  const { error: errorUpdate } = await supabase
    .from("cotizaciones")
    .update({
      cliente_id: clienteCreado.id,
      cliente_nombre: clienteCreado.nombre,
      es_prospecto: false,
    })
    .eq("id", cotizacionId);
  if (errorUpdate) throw errorUpdate;

  if (user) {
    await registrarActividad({
      modulo: "cotizaciones",
      accion: "convertir_prospecto_a_cliente",
      entidadId: cotizacionId,
      entidadNombre: clienteCreado.nombre,
      detalles: { cliente_id: clienteCreado.id },
    });
  }

  return clienteCreado;
}
