/**
 * Barrel raíz del feature `tesoreria` (piloto O4, auditoría 2026-07-29).
 * Superficie pública hacia otros features. Los deep imports desde FUERA
 * del feature (`@/features/tesoreria/services/<modulo>`, `/components/…`,
 * `/domain/import/…`) están bloqueados para código nuevo por el
 * architecture test `feature-barrel-surface.test.ts` (baseline en
 * burn-down para los existentes). `domain/` NO se re-exporta aquí porque
 * `services/` ya re-exporta sus tipos canónicos; las funciones puras de
 * dominio se consumen vía `./domain` (barrel de subcapa permitido).
 */
export * from "./services";
export * from "./hooks";
