import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  useCliente,
  useContactosCliente,
  useCreateContacto,
  useUpdateContacto,
  useDeleteContacto,
  useUpdateCliente,
  useEmbarquesCliente,
  useCotizacionesCliente,
} from "@/hooks/useClientes";
import { useClienteFinancials } from "@/hooks/useClienteFinancials";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { getErrorMessage } from "@/lib/errors";
import type { Tables, Enums } from "@/integrations/supabase/types";

type ContactoCliente = Tables<"contactos_cliente">;
type TipoContacto = Enums<"tipo_contacto">;

export interface ContactoFormData {
  nombre: string;
  rfc: string;
  tipo: TipoContacto;
  pais: string;
  ciudad: string;
  direccion: string;
  contacto: string;
  email: string;
  telefono: string;
}

export interface ClienteFormData {
  nombre: string;
  rfc: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  contacto: string;
  email: string;
  telefono: string;
}

/**
 * Controller-hook para la página de detalle de cliente. Centraliza queries,
 * mutations, estado de diálogos y handlers, dejando ClienteDetalle.tsx como
 * composición pura de UI.
 */
export function useClienteDetalleController() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Queries
  const { data: cliente, isLoading: loadingCliente } = useCliente(id);
  const { data: contactos = [], isLoading: loadingContactos } = useContactosCliente(id);
  const { data: embarquesCliente = [], isLoading: loadingEmbarques } = useEmbarquesCliente(id);
  const { data: cotizacionesCliente = [], isLoading: loadingCotizaciones } = useCotizacionesCliente(id);
  const { data: financials } = useClienteFinancials(id);

  // Mutations
  const createContacto = useCreateContacto();
  const updateContacto = useUpdateContacto();
  const deleteContacto = useDeleteContacto();
  const updateCliente = useUpdateCliente();

  // Permisos / bitácora
  const { canEdit } = usePermissions();
  const registrarActividad = useRegistrarActividad();

  // Estado de diálogos
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContacto, setEditingContacto] = useState<ContactoCliente | null>(null);
  const [editClienteOpen, setEditClienteOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContactoId, setDeletingContactoId] = useState<string | null>(null);

  // Handlers
  const handleSaveContacto = async (data: ContactoFormData, editingId: string | null) => {
    if (!cliente) return;
    try {
      if (editingId) {
        await updateContacto.mutateAsync({ id: editingId, cliente_id: cliente.id, ...data });
        toast({ title: "Contacto actualizado" });
      } else {
        await createContacto.mutateAsync({ cliente_id: cliente.id, ...data });
        toast({ title: "Contacto creado" });
      }
      setContactDialogOpen(false);
      setEditingContacto(null);
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const handleSaveCliente = async (data: ClienteFormData) => {
    if (!cliente) return;
    try {
      await updateCliente.mutateAsync({ id: cliente.id, ...data });
      registrarActividad.mutate({
        accion: "editar",
        modulo: "clientes",
        entidad_id: cliente.id,
        entidad_nombre: data.nombre,
      });
      toast({ title: "Cliente actualizado" });
      setEditClienteOpen(false);
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
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
      toast({ title: "Contacto eliminado" });
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
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
    // navegación
    navigate,
    // datos
    cliente,
    loadingCliente,
    contactos,
    loadingContactos,
    embarquesCliente,
    loadingEmbarques,
    cotizacionesCliente,
    loadingCotizaciones,
    financials,
    // permisos
    canEdit,
    // mutations (estado pending para diálogos)
    isContactSaving: createContacto.isPending || updateContacto.isPending,
    isClientSaving: updateCliente.isPending,
    isContactDeleting: deleteContacto.isPending,
    // estado de diálogos
    contactDialogOpen,
    setContactDialogOpen,
    editingContacto,
    editClienteOpen,
    setEditClienteOpen,
    deleteDialogOpen,
    closeDeleteDialog,
    // handlers
    handleSaveContacto,
    handleSaveCliente,
    startDelete,
    confirmDelete,
    openNewContact,
    openEditContact,
  };
}
