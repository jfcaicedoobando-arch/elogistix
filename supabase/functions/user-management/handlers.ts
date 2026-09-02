/**
 * Barrel de handlers para la función consolidada `user-management`.
 * La lógica se extrajo a archivos por acción para respetar Power-of-10
 * (<200 líneas por archivo productivo). Cada re-export preserva la firma
 * pública consumida por `index.ts` y los tests.
 */
export type { HandlerCtx, AdminAccess } from "./types.ts";
export { validateCreatePayload, handleCreate } from "./createHandler.ts";
export { handleDelete } from "./deleteHandler.ts";
export { handleList, resolveOrgScope } from "./listHandler.ts";
export { handleListNombres } from "./listNombresHandler.ts";
export { resolveRedirectTo, handleInviteClient, handleListClients } from "./clientHandlers.ts";
