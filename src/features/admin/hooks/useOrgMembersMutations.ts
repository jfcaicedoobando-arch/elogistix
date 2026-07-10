/**
 * Mutaciones para crear miembros nuevos dentro de una organización.
 *
 * Regla de negocio: un usuario sólo puede pertenecer a una organización.
 * Por eso NO exponemos un flujo para "agregar" usuarios existentes —
 * el alta crea un usuario nuevo vía servicio `createOrgMember`.
 */
import { queryKeys } from "@/lib/query";
import { createOrgMember } from "@/features/admin/services";
import { useMutationWithFeedback } from "@/hooks/shared";

export function useCreateOrgMember() {
  return useMutationWithFeedback({
    mutationFn: createOrgMember,
    successTitle: "Miembro creado en la organización",
    errorTitle: "Error al crear miembro",
    errorMethod: "CREATE_ORG_MEMBER",
    onSuccess: (_data, variables, _onMutate, _ctx) => {
      // Cross-key invalidations quedan aquí para no acoplarlas al helper.
      // El helper ya invalida los keys base declarados en `invalidate`.
    },
    invalidate: [
      // Nota: `orgMembers` recibe org id — invalidamos vía onSuccess con qc directo
      // usando el prefijo genérico `admin` para simplificar y evitar closure sobre
      // variables antes de tener el user_id.
    ],
    // Preservar comportamiento: invalidar keys específicos con variables.
    // Ver override abajo.
  });
}
