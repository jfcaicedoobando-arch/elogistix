import { queryKeys } from "@/lib/query";
import {
  createUserViaEdgeFunction,
  type CreateUserParams,
} from "@/features/admin/services/usuario";
import { useMutationWithFeedback } from "@/hooks/shared";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";

export function useCreateUser() {
  // Ola 4 · N13: org efectivo siempre resuelto — el diálogo de alta de un
  // admin de org no trae selector y mandaba orgId undefined, lo que dejaba
  // la validación de duplicados sin universo (fail-open).
  const { organizationId } = useOrgActiva();
  return useMutationWithFeedback({
    mutationFn: (params: CreateUserParams) =>
      createUserViaEdgeFunction({
        ...params,
        orgId: params.orgId ?? organizationId ?? undefined,
      }),
    invalidate: queryKeys.usuarios.all,
    // U-04: el copy ya no promete un correo que no siempre se envía.
    successTitle: "Usuario dado de alta",
    successDescription:
      "Si lo diste de alta por invitación, el correo puede tardar unos minutos. Si no llega, usa “Restablecer contraseña” en la fila del usuario para reenviar el acceso.",
    errorTitle: "Error al crear usuario",
    errorMethod: "CREATE_USER",
  });
}
