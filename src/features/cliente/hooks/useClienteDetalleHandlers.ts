/**
 * Sub-hook con los handlers del controller de detalle de cliente.
 * Extraído para mantener `useClienteDetalleController.ts` ≤200 LOC.
 */
import { useState } from "react";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { diffFields, SENSITIVE_FIELDS } from "@/features/auditoria/utils/diffFields";
import { getErrorMessage } from "@/lib/errors";
import type { Tables } from "@/integrations/supabase/types";
import type { ContactoFormData, ClienteFormData } from "./useClienteDetalleController.types";

type ContactoCliente = Tables<"contactos_cliente">;

interface Deps {
  cliente: { id: string } | null | undefined;
  createContacto: { mutateAsync: (d: { cliente_id: string } & ContactoFormData) => Promise<unknown> };
  updateContacto: { mutateAsync: (d: { id: string; cliente_id: string } & ContactoFormData) => Promise<unknown> };
  deleteContacto: { mutateAsync: (d: { id: string; cliente_id: string }) => Promise<unknown> };
  updateCliente: { mutateAsync: (d: { id: string } & ClienteFormData) => Promise<unknown> };
  registrarActividad: {
    mutate: (d: {
      accion: string;
      modulo: string;
      entidad_id?: string | null;
      entidad_nombre?: string;
      detalles?: Record<string, unknown>;
    }) => void;
  };
}

export function useClienteDetalleHandlers(deps: Deps) {
  const { cliente, createContacto, updateContacto, deleteContacto, updateCliente, registrarActividad } = deps;

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContacto, setEditingContacto] = useState<ContactoCliente | null>(null);
  const [editClienteOpen, setEditClienteOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContactoId, setDeletingContactoId] = useState<string | null>(null);

  const handleSaveContacto = async (data: ContactoFormData, editingId: string | null) => {
    if (!cliente) return;
    try {
      if (editingId) {
        await updateContacto.mutateAsync({ id: editingId, cliente_id: cliente.id, ...data });
        notifySuccess(undefined, { title: "Contacto actualizado" });
      } else {
        await createContacto.mutateAsync({ cliente_id: cliente.id, ...data });
        notifySuccess(undefined, { title: "Contacto creado" });
      }
      setContactDialogOpen(false);
      setEditingContacto(null);
    } catch (err: unknown) {
      notifyError(undefined, { title: "Error", description: getErrorMessage(err), error: err, method: "HANDLE_SAVE_CONTACTO" });
    }
  };

  const handleSaveCliente = async (data: ClienteFormData) => {
    if (!cliente) return;
    try {
      const cambios = diffFields<ClienteFormData>(
        cliente as Partial<ClienteFormData>,
        data,
        SENSITIVE_FIELDS.cliente,
      );
      await updateCliente.mutateAsync({ id: cliente.id, ...data });
      registrarActividad.mutate({
        accion: "editar",
        modulo: "clientes",
        entidad_id: cliente.id,
        entidad_nombre: data.nombre,
        detalles: cambios.length > 0 ? { cambios } : undefined,
      });
      notifySuccess(undefined, { title: "Cliente actualizado" });
      setEditClienteOpen(false);
    } catch (err: unknown) {
      notifyError(undefined, { title: "Error", description: getErrorMessage(err), error: err, method: "HANDLE_SAVE_CLIENTE" });
    }
  };

  const startDelete = (contactoId: string) => {
    setDeletingContactoId(contactoId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingContactoId || !cliente) return;
    try {
      await deleteContacto.mutateAsync({ id: deletingContactoId, cliente_id: cliente.id });
      notifySuccess(undefined, { title: "Contacto eliminado" });
    } catch (err: unknown) {
      notifyError(undefined, { title: "Error", description: getErrorMessage(err), error: err, method: "CONFIRM_DELETE" });
    }
  };

  const openNewContact = () => {
    setEditingContacto(null);
    setContactDialogOpen(true);
  };

  const openEditContact = (c: ContactoCliente) => {
    setEditingContacto(c);
    setContactDialogOpen(true);
  };

  const closeDeleteDialog = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) setDeletingContactoId(null);
  };

  return {
    contactDialogOpen, setContactDialogOpen,
    editingContacto,
    editClienteOpen, setEditClienteOpen,
    deleteDialogOpen, closeDeleteDialog,
    handleSaveContacto, handleSaveCliente,
    startDelete, confirmDelete,
    openNewContact, openEditContact,
  };
}
