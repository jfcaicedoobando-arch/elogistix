// Barrel público del feature Cliente.
// Exporta sólo hooks para evitar colisión de nombres (Cliente, ContactoCliente)
// con tipos definidos tanto en `services/crud.ts` como en `types/cliente.ts`.
// Los consumidores que necesiten servicios o tipos directamente deben importar
// desde `@/features/cliente/services` o `@/features/cliente/types/cliente`.
export * from "./hooks";
export * as clienteQueryKeys from "./queryKeys";
