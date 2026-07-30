/**
 * Barrel del servicio de usuarios de organización.
 * La lógica vive en `./listado.ts` (consultas) y `./mutaciones.ts` (altas,
 * bajas y cambios de rol) para respetar el límite de 200 líneas por archivo.
 */
import { UNRESOLVED_EMAIL } from "./constants";

// Re-export para no romper callers históricos que importan desde el barrel.
// UNRESOLVED_EMAIL vive en `./constants.ts` (extraído en Sprint 2 · ítem 4b
// para romper el ciclo `portales.ts → ./index → portales.ts`).
export { UNRESOLVED_EMAIL };

export {
  fetchUsuariosOrganizacion,
  fallóDirectorioUsuarios,
  type UserRow,
  type EstadoInvitacion,
} from "./listado";

export {
  updateUserRole,
  deleteUserViaEdgeFunction,
  deleteUserViaEdgeFunctionAuth,
  createUserViaEdgeFunction,
  type CreateUserParams,
  type CreateUserResponse,
} from "./mutaciones";
