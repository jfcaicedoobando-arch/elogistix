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
} from "@/features/cliente/hooks/useClientes";
import { useClienteFinancials } from "@/features/cliente/hooks/useClienteFinancials";
import { usePermissions, useRegistrarActividad } from "@/hooks/shared";
import { useClienteDetalleHandlers } from "./useClienteDetalleHandlers";

;

/**
 * Controller-hook para la página de detalle de cliente. Centraliza queries,
 * mutations, estado de diálogos y handlers, dejando ClienteDetalle.tsx como
 * composición pura de UI. Los handlers viven en `useClienteDetalleHandlers.ts`
 * y los tipos en `useClienteDetalleController.types.ts` (Power-of-10 ≤200 LOC).
 */
export function useClienteDetalleController() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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

  // Handlers + estado de diálogos (sub-hook)
  const handlers = useClienteDetalleHandlers({
    cliente,
    createContacto,
    updateContacto,
    deleteContacto,
    updateCliente,
    registrarActividad,
  });

  return {
    navigate,
    cliente,
    loadingCliente,
    contactos,
    loadingContactos,
    embarquesCliente,
    loadingEmbarques,
    cotizacionesCliente,
    loadingCotizaciones,
    financials,
    canEdit,
    isContactSaving: createContacto.isPending || updateContacto.isPending,
    isClientSaving: updateCliente.isPending,
    isContactDeleting: deleteContacto.isPending,
    ...handlers,
  };
}
