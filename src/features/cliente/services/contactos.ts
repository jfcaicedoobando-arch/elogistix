import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { run, unwrap, unwrapOr } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";

export type ContactoCliente = Tables<"contactos_cliente">;

export const CONTACTO_COLUMNS =
  "id, cliente_id, tipo, nombre, contacto, rfc, telefono, email, direccion, ciudad, pais, organization_id, created_at, deleted_at, deleted_by" as const;

export async function fetchContactosCliente(clienteId: string) {
  return unwrapOr(
    supabase
      .from("contactos_cliente")
      .select(CONTACTO_COLUMNS)
      .eq("cliente_id", clienteId)
      .order("nombre"),
    [],
  );
}

export async function createContacto(
  contacto: TablesInsert<"contactos_cliente">,
) {
  const creado = await unwrap(
    supabase.from("contactos_cliente").insert(contacto).select().single(),
  );
  await registrarActividad({
    modulo: "clientes",
    accion: "Creó contacto de cliente",
    entidadId: (creado as { id?: string })?.id ?? null,
    entidadNombre: contacto.nombre ?? "",
    detalles: { clienteId: contacto.cliente_id },
  });
  return creado;
}

export async function updateContacto(
  id: string,
  updates: Partial<ContactoCliente>,
) {
  await run(supabase.from("contactos_cliente").update(updates).eq("id", id));
  await registrarActividad({
    modulo: "clientes",
    accion: "Editó contacto de cliente",
    entidadId: id,
    detalles: { campos: Object.keys(updates) },
  });
}

export async function deleteContacto(id: string) {
  // Soft delete vía RPC (A.2.2).
  await run(
    supabase.rpc("soft_delete_record", { _table: "contactos_cliente", _id: id }),
  );
  await registrarActividad({
    modulo: "clientes",
    accion: "Eliminó contacto de cliente",
    entidadId: id,
  });
}
