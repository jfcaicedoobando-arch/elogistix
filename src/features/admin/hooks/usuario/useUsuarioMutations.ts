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
    // U-04: el copy ya no promete un correo que no siempre se envía.
    successTitle: "Usuario dado de alta",
    errorTitle: "Error al crear usuario",
    errorMethod: "CREATE_USER",
  });
}
