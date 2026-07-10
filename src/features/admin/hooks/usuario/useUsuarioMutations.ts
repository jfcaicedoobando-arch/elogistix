import { queryKeys } from "@/lib/query";
import {
  createUserViaEdgeFunction,
  type CreateUserParams,
} from "@/features/admin/services/usuario";
import { useMutationWithFeedback } from "@/hooks/shared";

export function useCreateUser() {
  return useMutationWithFeedback({
    mutationFn: (params: CreateUserParams) => createUserViaEdgeFunction(params),
    invalidate: queryKeys.usuarios.all,
    successTitle: "Usuario creado e invitación enviada",
    errorTitle: "Error al crear usuario",
    errorMethod: "CREATE_USER",
  });
}
